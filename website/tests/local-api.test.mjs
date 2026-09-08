import assert from "node:assert/strict";
import test from "node:test";
import {
  localSections,
  localMediaFields,
  localDeviceFields,
  localExamples,
} from "../app/local-api.ts";
import { searchDocumentation } from "../app/doc-search.ts";

test("local API response examples use documented fields and consistent sync IDs", () => {
  assert.equal(
    new Set(localSections.map(([id]) => id)).size,
    localSections.length,
  );
  assert.deepEqual(
    Object.keys(localExamples.media).sort(),
    localMediaFields.map(({ name }) => name).sort(),
  );
  assert.deepEqual(
    Object.keys(localExamples.device).sort(),
    localDeviceFields
      .filter(({ name }) => name !== "id")
      .map(({ name }) => name)
      .sort(),
  );
  const { configs, targets } = localExamples.sync;
  for (const target of targets) {
    assert.ok(configs.some((config) => config.id === target.cid));
    assert.ok(target.key.endsWith(`@@@${target.cid}`));
  }
  for (const entry of localExamples.folder.files) {
    assert.ok(entry.path.startsWith("/TV/"));
    assert.ok([0, 1].includes(entry.dir));
  }
});

test("local endpoint searches lead to their defining sections", () => {
  for (const [query, anchor] of [
    ["LOCAL.md", "connection"],
    ["/action", "action"],
    ["do=sync", "sync"],
    ["/media", "media"],
    ["/device", "device"],
    ["/upload", "files"],
    ["/cache", "cache"],
    ["/parse", "internal"],
  ]) {
    assert.equal(
      searchDocumentation(query)[0]?.href,
      `/local#${anchor}`,
      query,
    );
  }
});
