import assert from "node:assert/strict";
import test from "node:test";
import {
  configFieldGroups,
  filterFields,
  siteFields,
} from "../app/config-fields.ts";
import { resultFields, objectGroups, methods } from "../app/spider-fields.ts";
import { searchDocumentation } from "../app/doc-search.ts";

test("shared field data is unique and searchable, including surrounding whitespace", () => {
  for (const group of configFieldGroups) {
    assert.equal(
      new Set(group.fields.map((field) => field.name)).size,
      group.fields.length,
      group.label,
    );
    for (const field of group.fields) {
      assert.ok(field.description && field.type);
      assert.ok(
        searchDocumentation(field.name).length,
        `${group.label}.${field.name}`,
      );
    }
  }
  assert.deepEqual(
    filterFields(siteFields, " LANG ").map((field) => field.name),
    ["lang"],
  );
  assert.deepEqual(filterFields(siteFields, "no-such-field"), []);
  assert.equal(filterFields(siteFields, "   ").length, siteFields.length);
});

test("search covers actual method, object, Result and feature vocabulary", () => {
  for (const query of [
    "homeContent",
    "vod_id",
    "drm",
    "lang",
    "字幕",
    "PiP",
    "Node",
    "siteKey",
  ]) {
    assert.ok(searchDocumentation(query).length, query);
  }
  for (const field of resultFields)
    assert.ok(
      searchDocumentation(field.name).some(
        ({ href }) => href === "/spider#result",
      ),
      field.name,
    );
  for (const group of objectGroups) {
    for (const [names] of group.fields) {
      for (const name of names.split(" / "))
        assert.ok(
          searchDocumentation(name).some(
            ({ href }) => href === "/spider#objects",
          ),
          name,
        );
    }
  }
  for (const [names] of methods) {
    for (const name of names.split(" / "))
      assert.ok(
        searchDocumentation(name).some(
          ({ href }) => href === "/spider#lifecycle",
        ),
        name,
      );
  }
  assert.deepEqual(searchDocumentation("something-not-documented"), []);
  assert.equal(searchDocumentation("   ").length, 4);
});

test("exact identifiers rank their defining section ahead of incidental text", () => {
  const suggestions = searchDocumentation("");
  for (const [query, href] of [
    [" so ", "/config#core"],
    ["RESP", "/config#core"],
    ["homeContent", "/spider#lifecycle"],
    ["vod_id", "/spider#objects"],
    ["jxFrom", "/spider#result"],
  ]) {
    assert.equal(searchDocumentation(query)[0]?.href, href, query);
  }
  assert.ok(
    searchDocumentation("lang").some(({ href }) => href === "/config#site"),
  );
  assert.ok(searchDocumentation("字幕").length);
  assert.ok(searchDocumentation("so").length <= 6);
  assert.deepEqual(searchDocumentation(""), suggestions);
});

test("documented contract distinctions survive content cleanup", () => {
  const find = (group, name) =>
    group.find((field) => field.name === name).description;
  assert.match(find(resultFields, "position"), /毫秒/);
  assert.match(find(resultFields, "key"), /覆寫/);
  assert.match(find(resultFields, "jxFrom"), /不是播放分組旗標/);
  assert.match(find(resultFields, "header"), /不逐鍵合併/);
  assert.match(find(siteFields, "categories"), /完全無匹配/);
  const all = JSON.stringify(configFieldGroups);
  assert.doesNotMatch(all, /回應標頭|只附加/);
  assert.match(all, /groups 為空/);
  assert.match(all, /設定 drm 時 URL 原樣/);
});
