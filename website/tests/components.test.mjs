import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { filterFields, siteFields } from "../app/config-fields.ts";
import { searchDocumentation } from "../app/doc-search.ts";

// Handler tests only: re-render returned trees manually, without simulating
// React reconciliation, DOM layout, or effect/listener lifecycles.
async function component(name, props, writeText = async () => {}) {
  const source = await readFile(
    new URL(`../app/${name}.tsx`, import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const state = [];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] = value;
        },
      ];
    },
    useRef(value) {
      return hooks.useState({ current: value })[0];
    },
    useId() {
      return "test";
    },
    useEffect() {},
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    navigator: { clipboard: { writeText } },
    require(id) {
      if (id === "react") return hooks;
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "./CopyButton") return { CopyButton: "CopyButton" };
      if (id === "next/link") return { default: "a" };
      if (id === "./icons") return { SearchIcon: "SearchIcon" };
      if (id === "./doc-search") return { searchDocumentation };
      if (id === "./config-fields") return { filterFields };
      throw new Error(`Unexpected component dependency ${id}`);
    },
  });
  return () => {
    cursor = 0;
    return exports[name](props);
  };
}

function nodes(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node))
    return node.flatMap((child) => nodes(child, predicate));
  return [
    ...(predicate(node) ? [node] : []),
    ...nodes(node.props?.children, predicate),
  ];
}

test("copy feedback reports success and a useful failure state", async () => {
  const copied = [];
  const render = await component(
    "CopyButton",
    { text: '{"ok":true}', label: "JSON" },
    async (text) => copied.push(text),
  );
  await nodes(render(), (node) => node.type === "button")[0].props.onClick();
  assert.deepEqual(copied, ['{"ok":true}']);
  assert.equal(
    nodes(render(), (node) => node.props?.role === "status")[0].props.children,
    "JSON已複製",
  );
  const rejected = await component(
    "CopyButton",
    { text: "x", label: "JSON" },
    async () => {
      throw new Error("denied");
    },
  );
  await nodes(rejected(), (node) => node.type === "button")[0].props.onClick();
  assert.match(
    nodes(rejected(), (node) => node.props?.role === "alert")[0].props.children,
    /請選取程式碼後複製/,
  );
});

test("copy exposes its pending state and recovers after completion or rejection", async () => {
  for (const outcome of ["resolve", "reject"]) {
    let settle;
    const render = await component(
      "CopyButton",
      { text: "x", label: "JSON" },
      () =>
        new Promise((resolve, reject) => {
          settle = outcome === "resolve" ? resolve : reject;
        }),
    );
    const pending = nodes(
      render(),
      (node) => node.type === "button",
    )[0].props.onClick();
    const button = nodes(render(), (node) => node.type === "button")[0];
    assert.equal(button.props.disabled, true);
    assert.equal(button.props["aria-busy"], true);
    assert.equal(button.props.children, "稍候");
    assert.match(
      nodes(render(), (node) => node.props?.role === "status")[0].props
        .children,
      /正在複製/,
    );
    settle();
    await pending;
    assert.equal(
      nodes(render(), (node) => node.type === "button")[0].props.disabled,
      false,
    );
    assert.equal(
      nodes(render(), (node) => node.props?.role === "alert").length,
      outcome === "reject" ? 1 : 0,
    );
  }
});

test("copy clears a previous error when the user copies again", async () => {
  const copied = [];
  const render = await component(
    "CopyButton",
    { text: "{}", label: "JSON" },
    async (text) => {
      copied.push(text);
      if (copied.length === 1) throw new Error("denied");
    },
  );
  await nodes(render(), (node) => node.type === "button")[0].props.onClick();
  assert.equal(
    nodes(render(), (node) => node.props?.role === "alert").length,
    1,
  );
  const pending = nodes(
    render(),
    (node) => node.type === "button",
  )[0].props.onClick();
  assert.equal(
    nodes(render(), (node) => node.props?.role === "alert").length,
    0,
  );
  await pending;
  const button = nodes(render(), (node) => node.type === "button")[0];
  assert.deepEqual(copied, ["{}", "{}"]);
  assert.equal(button.props["aria-busy"], false);
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.children, "已複製");
});

test("code header keeps the filename separate from its copy control", async () => {
  for (const path of [undefined, "VodConfig 頂層欄位片段"]) {
    const render = await component("CodeBlock", {
      label: "JSON / shared",
      path,
      children: "{}",
    });
    const header = nodes(
      render(),
      (node) => node.props?.className === "code-card-head",
    )[0];
    const children = header.props.children.filter(Boolean);
    assert.equal(children[0].type, "span");
    assert.equal(children.at(-1).type, "CopyButton");
    if (path) {
      assert.equal(children[1].type, "code");
      assert.equal(children[1].props.children, path);
    }
  }
});

test("language navigation isolates copy feedback by sample identity", async () => {
  const render = await component("CodeTabs", {
    samples: [
      { id: "java", label: "Java", file: "Demo.java", code: "java-code" },
      { id: "python", label: "Python", file: "demo.py", code: "python-code" },
      { id: "js", label: "JavaScript", file: "demo.js", code: "js-code" },
    ],
  });
  let view = render();
  const firstCopy = nodes(view, (node) => node.type === "CopyButton")[0];
  let complete;
  const first = await component(
    "CopyButton",
    firstCopy.props,
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = nodes(
    first(),
    (node) => node.type === "button",
  )[0].props.onClick();
  nodes(view, (node) => node.props?.role === "tab")[0].props.onKeyDown({
    key: "End",
    preventDefault() {},
  });
  view = render();
  const nextCopy = nodes(view, (node) => node.type === "CopyButton")[0];
  assert.notEqual(firstCopy.key, nextCopy.key);
  assert.equal(nextCopy.props.text, "js-code");
  const next = await component("CopyButton", nextCopy.props);
  complete();
  await pending;
  assert.equal(
    nodes(next(), (node) => node.props?.role === "status")[0].props.children,
    "",
  );
  const tabs = nodes(view, (node) => node.props?.role === "tab");
  assert.equal(tabs[2].props["aria-selected"], true);
  tabs[2].props.onKeyDown({ key: "ArrowRight", preventDefault() {} });
  assert.equal(
    nodes(render(), (node) => node.props?.role === "tab")[0].props[
      "aria-selected"
    ],
    true,
  );
});

test("tab handlers keep selection, focus, panel, filename, and copy text aligned", async () => {
  const samples = [
    { id: "java", label: "Java", file: "Demo.java", code: "java-code" },
    { id: "python", label: "Python", file: "demo.py", code: "python-code" },
    { id: "js", label: "JavaScript", file: "demo.js", code: "js-code" },
  ];
  const render = await component("CodeTabs", { samples });
  let view = render();
  const focused = [];
  nodes(view, (node) => node.props?.role === "tab").forEach((tab, index) => {
    tab.props.ref({ focus: () => focused.push(index) });
  });

  function assertSample(index) {
    const tabs = nodes(view, (node) => node.props?.role === "tab");
    const panels = nodes(view, (node) => node.props?.role === "tabpanel");
    assert.equal(tabs.length, samples.length);
    assert.equal(panels.length, samples.length);
    tabs.forEach((tab, position) => {
      assert.equal(tab.props["aria-selected"], position === index);
      assert.equal(tab.props.tabIndex, position === index ? 0 : -1);
      assert.equal(panels[position].props.hidden, position !== index);
      assert.equal(tab.props["aria-controls"], panels[position].props.id);
      assert.equal(panels[position].props["aria-labelledby"], tab.props.id);
    });
    const visible = panels.filter((panel) => !panel.props.hidden);
    assert.equal(visible.length, 1);
    assert.equal(
      nodes(visible[0], (node) => node.type === "code")[0].props.children,
      samples[index].code,
    );
    assert.equal(
      nodes(view, (node) => node.props?.className === "code-file")[0].props
        .children,
      samples[index].file,
    );
    const copy = nodes(view, (node) => node.type === "CopyButton")[0];
    assert.equal(copy.props.text, samples[index].code);
    assert.equal(copy.props.label, `${samples[index].label} Demo`);
    assert.equal(copy.key, samples[index].id);
  }

  assertSample(0);
  nodes(view, (node) => node.props?.role === "tab")[1].props.onClick();
  view = render();
  assertSample(1);

  for (const [key, expected] of [
    ["Home", 0],
    ["ArrowLeft", 2],
    ["ArrowRight", 0],
    ["ArrowRight", 1],
    ["ArrowLeft", 0],
    ["End", 2],
    ["Home", 0],
  ]) {
    const active = nodes(view, (node) => node.props?.role === "tab").find(
      (tab) => tab.props["aria-selected"],
    );
    let prevented = 0;
    focused.length = 0;
    active.props.onKeyDown({
      key,
      preventDefault() {
        prevented++;
      },
    });
    view = render();
    assert.equal(prevented, 1);
    assert.deepEqual(focused, [expected]);
    assertSample(expected);
  }
});

test("search input handler updates results, reports no match, and restores suggestions", async () => {
  const render = await component("QuickSearch");
  let view = render();
  const links = () =>
    nodes(view, (node) => node.type === "a").map((link) => ({
      href: link.props.href,
      title: nodes(link, (node) => node.type === "b")[0].props.children,
      description: nodes(link, (node) => node.type === "small")[0].props
        .children,
    }));
  const initial = links();
  assert.equal(initial.length, 4);

  for (const query of ["homeContent", "no-such-document-98765", ""]) {
    nodes(view, (node) => node.type === "input")[0].props.onChange({
      target: { value: query },
    });
    view = render();
    assert.equal(
      nodes(view, (node) => node.type === "input")[0].props.value,
      query,
    );
    assert.deepEqual(
      links(),
      searchDocumentation(query).map(({ href, title, description }) => ({
        href,
        title,
        description,
      })),
    );
    const empty = nodes(view, (node) => node.type === "p");
    if (query === "no-such-document-98765") {
      assert.equal(links().length, 0);
      assert.match(empty[0].props.children, /找不到符合的條目/);
    } else {
      assert.equal(empty.length, 0);
      if (query) assert.equal(links()[0].href, "/spider#lifecycle");
      else assert.deepEqual(links(), initial);
    }
  }
});

test("field input handler updates rows and count, reports no match, and restores fields", async () => {
  const render = await component("FieldTable", {
    fields: siteFields,
    label: "Site",
  });
  let view = render();
  const rowNames = () => {
    const body = nodes(view, (node) => node.type === "tbody")[0];
    return nodes(body, (node) => node.type === "code").map(
      (node) => node.props.children,
    );
  };
  const initial = siteFields.map((field) => field.name);
  assert.deepEqual(rowNames(), initial);

  for (const [query, expected] of [
    ["lang", ["lang"]],
    ["no-such-field-98765", []],
    ["", initial],
  ]) {
    nodes(view, (node) => node.type === "input")[0].props.onChange({
      target: { value: query },
    });
    view = render();
    assert.equal(
      nodes(view, (node) => node.type === "input")[0].props.value,
      query,
    );
    assert.deepEqual(rowNames(), expected);
    const count = nodes(view, (node) => node.type === "b")[0];
    assert.equal(count.props.children.join(""), `${expected.length} 欄位`);
    const empty = nodes(view, (node) => node.props?.role === "status");
    assert.equal(empty.length, expected.length ? 0 : 1);
    if (!expected.length)
      assert.match(empty[0].props.children, /找不到符合的欄位/);
  }
});
