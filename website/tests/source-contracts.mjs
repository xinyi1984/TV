import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resultFields } from "../app/spider-fields.ts";
import {
  localActions,
  localControls,
  localRefresh,
  localCacheActions,
  localMediaFields,
  localDeviceFields,
} from "../app/local-api.ts";

function source(path) {
  return readFile(new URL(`../../app/src/${path}`, import.meta.url), "utf8");
}

function cases(java, method) {
  const body = java
    .split(`void ${method}(`)[1]
    ?.split(/\n    (?:private|public) /)[0];
  assert.ok(body, method);
  return [...body.matchAll(/case "([^"]+)"/g)].map((match) => match[1]).sort();
}

test("local action, control, refresh and cache references cover Android handlers", async () => {
  const action = await source(
    "main/java/com/fongmi/android/tv/server/process/Action.java",
  );
  for (const [method, rows] of [
    ["doJob", localActions],
    ["onControl", localControls],
    ["onRefresh", localRefresh],
  ]) {
    assert.deepEqual(rows.map(([name]) => name).sort(), cases(action, method));
  }
  const cache = await source(
    "main/java/com/fongmi/android/tv/server/process/Cache.java",
  );
  assert.deepEqual(
    localCacheActions.map(([name]) => name).sort(),
    [...cache.matchAll(/"([^"]+)"\.equals\(action\)/g)]
      .map((match) => match[1])
      .sort(),
  );
});

test("local response fields and corrected state values match Android source", async () => {
  const media = await source(
    "main/java/com/fongmi/android/tv/server/process/Media.java",
  );
  const device = await source(
    "main/java/com/fongmi/android/tv/bean/Device.java",
  );
  assert.deepEqual(
    localMediaFields.map(({ name }) => name).sort(),
    [...media.matchAll(/result\.addProperty\("([^"]+)"/g)]
      .map((match) => match[1])
      .sort(),
  );
  assert.deepEqual(
    localDeviceFields.map(({ name }) => name).sort(),
    [...device.matchAll(/@SerializedName\("([^"]+)"\)/g)]
      .map((match) => match[1])
      .sort(),
  );
  assert.match(media, /STATE_BUFFERING\) return 6;/);
  assert.match(media, /STATE_READY\) return 2;/);
  assert.match(media, /isPlaying\(\)\) return 3;/);
  assert.match(
    localMediaFields.find(({ name }) => name === "state").description,
    /6＝緩衝中/,
  );
  for (const [flavor, type] of [
    ["leanback", 0],
    ["mobile", 1],
  ]) {
    assert.match(
      await source(`${flavor}/java/com/fongmi/android/tv/Product.java`),
      new RegExp(`getDeviceType\\(\\)\\s*\\{\\s*return ${type};`),
    );
  }
  assert.ok(device.includes("device.setTime(App.time());"));
  const app = await source("main/java/com/fongmi/android/tv/App.java");
  assert.match(app, /time = System\.currentTimeMillis\(\)/);
  const nano = await source("main/java/com/fongmi/android/tv/server/Nano.java");
  assert.ok(nano.includes("Response.Status.OK, MIME_PLAINTEXT, text"));
});

test("Result reference covers every serialized field in the adjacent TV source", async () => {
  const source = await readFile(
    new URL(
      "../../app/src/main/java/com/fongmi/android/tv/bean/Result.java",
      import.meta.url,
    ),
    "utf8",
  );
  const actual = [...source.matchAll(/@SerializedName\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(resultFields.map((field) => field.name).sort(), actual);
});
