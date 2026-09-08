import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { basePath, siteUrl } from "../app/site-config.ts";

const routes = ["/", "/config", "/spider", "/local", "/features"];

async function render(pathname = "/") {
  return readFile(
    new URL(
      `../out${pathname === "/" ? "" : pathname}/index.html`,
      import.meta.url,
    ),
    "utf8",
  );
}

function attributes(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "g"))].map(
    ([tag]) =>
      Object.fromEntries(
        [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [
          name,
          value.replace(/&amp;/g, "&"),
        ]),
      ),
  );
}

function decodeCode(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

test("exports the finished developer hub as HTML", async () => {
  const html = await render();
  assert.match(html, /<title>影視TV Developer Hub<\/title>/i);
  assert.match(html, /你的影音體驗/);
  assert.match(html, /爬蟲介接/);
  assert.match(html, /配置字典/);
  assert.match(html, /App 功能/);
  assert.match(html, /影視TV 本身不內建或提供任何內容來源/);
  const search = attributes(html, "input").filter(
    (input) => input.type === "search",
  );
  assert.equal(search.length, 1);
  assert.equal(search[0]["aria-label"], "搜尋文件");
  assert.doesNotMatch(
    html,
    /codex-preview|SkeletonPreview|react-loading-skeleton|Your site is taking shape/i,
  );
});

test("removes starter artifacts", async () => {
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(
      new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url),
    ),
  );
  await assert.rejects(
    access(new URL("../app/_sites-preview/preview.css", import.meta.url)),
  );
});

test("renders copyable configuration examples", async () => {
  const html = await render("/config");
  assert.match(html, /先從可直接修改的配置開始/);
  assert.match(html, /\.\/demo\.js/);
  assert.match(html, /\.\/demo\.py/);
  assert.match(html, /\.\/live\.m3u/);
  assert.match(html, /配置倉庫 Depot/);
  assert.match(html, /#EXTVLCOPT:http-user-agent/);
  assert.match(html, /追看 \/ 時移 Catchup/);
  assert.match(html, /example\.com.*並不是可用來源/s);
});

test("keeps spider examples concrete and bridge-aware", async () => {
  const spider = await readFile(
    new URL("../app/spider/page.tsx", import.meta.url),
    "utf8",
  );
  const config = await readFile(
    new URL("../app/config/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(spider, /from base\.spider import Spider as BaseSpider/);
  assert.match(spider, /InputStream/);
  assert.match(spider, /第 5 格/);
  assert.doesNotMatch(
    spider,
    /\[Class\]|\[Filter\]|\[Vod\]|\[Sub\]|\[Danmaku\]|https:\/\/…/,
  );
  assert.match(config, /"core": \{/);
  assert.match(config, /"catchup": \{/);
  assert.match(config, /path="live\.m3u"/);
});

test("uses the supplied SVG logo and keeps the start card functional", async () => {
  await access(new URL("../out/logo.svg", import.meta.url));
  for (const route of routes) {
    const html = await render(route);
    assert.ok(
      attributes(html, "img").some(
        (image) => image.src === `${basePath}/logo.svg`,
      ),
      `${route} displays the supplied SVG logo`,
    );
  }
  const features = await render("/features");
  const start = features.match(
    /<section class="start-panel">([\s\S]*?)<\/section>/,
  )?.[1];
  assert.ok(start);
  assert.match(start, /class="start-label">開始使用<\/p>/);
  assert.ok(
    attributes(start, "a").some((link) => link.href === `${basePath}/config/`),
  );
  assert.doesNotMatch(
    features,
    /READY TO START|<p class="kicker"><span><\/span>/,
  );
});

test("displayed JSON remains valid after syntax highlighting", async () => {
  for (const pathname of ["/", "/config", "/spider", "/local"]) {
    const html = await render(pathname);
    const matches = [
      ...html.matchAll(
        /class="code-card"[^>]*aria-label="JSON[^"]*"[^>]*>[\s\S]*?<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g,
      ),
    ];
    assert.ok(matches.length > 0, pathname + " contains JSON examples");
    for (const match of matches)
      assert.doesNotThrow(() => JSON.parse(decodeCode(match[1])));
    assert.match(html, /class="code-key"/);
  }
});

test("displayed Proxy tuple preserves the QuickJS and Python bridge order", async () => {
  const html = await render("/spider");
  const code = html.match(
    /class="code-card"[^>]*aria-label="JSON \/ Proxy 陣列[^"]*"[^>]*>[\s\S]*?<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/,
  )?.[1];
  assert.ok(code, "Proxy example is present");
  const proxy = JSON.parse(decodeCode(code));
  assert.ok(Array.isArray(proxy));
  assert.equal(proxy.length, 4, "example includes response headers");
  const [status, contentType, body, headers] = proxy;
  assert.ok(Number.isInteger(status) && status >= 100 && status <= 599);
  assert.equal(typeof contentType, "string");
  assert.match(contentType, /^[\w.+-]+\/[\w.+-]+(?:;.*)?$/);
  assert.equal(typeof body, "string");
  assert.ok(headers !== null && typeof headers === "object");
  assert.equal(Array.isArray(headers), false);
  assert.ok(Object.values(headers).every((value) => typeof value === "string"));
});

test("local API renders every section and valid JSON form values", async () => {
  const { localSections } = await import("../app/local-api.ts");
  const html = await render("/local");
  assert.match(html, /<title>本地 API · 影視TV<\/title>/);
  for (const [id] of localSections) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /text\/plain/);
  const blocks = [...html.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)];
  let count = 0;
  for (const [, block] of blocks) {
    for (const [, json] of decodeCode(block).matchAll(/--data-urlencode '[\w]+=([\[{][^']*)'/g)) {
      assert.doesNotThrow(() => JSON.parse(json));
      count++;
    }
  }
  assert.equal(count, 6, "Vod, cast and sync form fields remain valid JSON");
});

test("all internal navigation targets exist and decorative numbering is gone", async () => {
  const pages = new Map();
  for (const path of routes) {
    pages.set(path, await render(path));
  }
  for (const [path, html] of pages) {
    assert.doesNotMatch(
      html,
      /class="(?:platform-mark|track-number|feature-line)"/,
    );
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const url = new URL(
        match[1].replace(/&amp;/g, "&"),
        `${siteUrl.origin}${basePath}${path === "/" ? "/" : path + "/"}`,
      );
      if (url.origin !== siteUrl.origin) continue;
      assert.ok(
        url.pathname.startsWith(basePath + "/"),
        `${path} -> ${url.href}`,
      );
      const target =
        url.pathname.slice(basePath.length).replace(/\/$/, "") || "/";
      if (!pages.has(target)) continue;
      if (url.hash)
        assert.ok(
          pages
            .get(target)
            .includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          `${path} -> ${url.href}`,
        );
    }
  }
});

test("each language tab controls its own existing panel", async () => {
  const html = await render("/spider");
  const tabs = attributes(html, "button").filter((tab) => tab.role === "tab");
  const panels = attributes(html, "pre").filter(
    (panel) => panel.role === "tabpanel",
  );
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  assert.equal(new Set(tabs.map((tab) => tab.id)).size, 3);
  assert.equal(new Set(panels.map((panel) => panel.id)).size, 3);
  assert.equal(tabs.filter((tab) => tab["aria-selected"] === "true").length, 1);
  assert.equal(panels.filter((panel) => !("hidden" in panel)).length, 1);
  for (const tab of tabs) {
    const panel = panels.find((panel) => panel.id === tab["aria-controls"]);
    assert.ok(panel, `${tab.id} controls an existing panel`);
    assert.equal(panel["aria-labelledby"], tab.id);
    const selected = tab["aria-selected"] === "true";
    assert.equal("hidden" in panel, !selected);
    assert.equal(tab.tabindex, selected ? "0" : "-1");
  }
});

test("metadata uses the configured URL and exported preview dimensions", async () => {
  const [html, preview] = await Promise.all([
    render(),
    readFile(new URL("../out/og.png", import.meta.url)),
  ]);
  const metadata = new Map(
    attributes(html, "meta").map((meta) => [
      meta.property ?? meta.name,
      meta.content,
    ]),
  );
  const previewUrl = new URL(`${basePath}/og.png`, siteUrl.origin).href;
  assert.equal(metadata.get("og:image"), previewUrl);
  assert.equal(metadata.get("twitter:image"), previewUrl);
  assert.deepEqual(
    [...preview.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.equal(
    metadata.get("og:image:width"),
    String(preview.readUInt32BE(16)),
  );
  assert.equal(
    metadata.get("og:image:height"),
    String(preview.readUInt32BE(20)),
  );
});

test("Depot is a separate file and complete configurations are labeled correctly", async () => {
  const html = await render("/config");
  assert.match(html, /depot\.json/);
  assert.doesNotMatch(html, /Access-Control-Allow-Origin/);
  assert.match(html, /live-config\.json/);
  assert.match(html, /VodConfig 頂層欄位片段/);
  const source = await readFile(
    new URL("../app/config/page.tsx", import.meta.url),
    "utf8",
  );
  const depot = JSON.parse(source.match(/depot: `([\s\S]*?)`/)[1]);
  assert.notEqual(depot.urls[0].url, "./depot.json");
  assert.equal(depot.urls[0].url, "./vod.json");
});

test("all exported links and assets resolve within the deployment directory", async () => {
  await access(new URL("../out/404.html", import.meta.url));
  await access(new URL("../out/.nojekyll", import.meta.url));
  for (const route of routes) {
    const html = await render(route);
    const pageUrl = `${siteUrl.origin}${basePath}${route === "/" ? "/" : route + "/"}`;
    for (const [, value] of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
      const url = new URL(value.replace(/&amp;/g, "&"), pageUrl);
      if (url.origin !== siteUrl.origin) continue;
      assert.ok(url.pathname.startsWith(basePath + "/"), url.href);
      const path = url.pathname.slice(basePath.length);
      await access(
        new URL(
          `../out${path}${path.endsWith("/") ? "index.html" : ""}`,
          import.meta.url,
        ),
      );
    }
    assert.doesNotMatch(html, /\/_vinext\/|cloudflare:workers/);
  }
});

test("static pages mark only their own primary navigation link as current", async () => {
  for (const route of routes) {
    const html = await render(route);
    const nav = html.match(/<nav aria-label="主要導覽">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, route);
    const active = [...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    assert.equal(active.length, route === "/" ? 0 : 1, route);
    if (active.length)
      assert.ok(active[0][0].includes(`href="${basePath}${route}/"`));
  }
});
