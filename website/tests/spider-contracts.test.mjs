import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/spider/page.tsx", import.meta.url), "utf8");
const extract = (name) => {
  const match = source.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));
  assert.ok(match, name + " example is present");
  return match[1];
};

test("JavaScript demo produces parseable Result objects across its data flow", async () => {
  const { default: spider } = await import("data:text/javascript;base64," + Buffer.from(extract("javascript")).toString("base64"));
  spider.init({});
  const home = JSON.parse(spider.home(true));
  const category = JSON.parse(spider.category(home.class[0].type_id, "1", true, {}));
  const itemId = category.list[0].vod_id;
  const detail = JSON.parse(spider.detail(itemId));
  const item = detail.list[0];
  assert.equal(item.vod_id, itemId);
  const flag = item.vod_play_from.split("$$$")[0].trim();
  const episode = item.vod_play_url.split("$$$")[0].split("#")[0];
  const separator = episode.indexOf("$");
  assert.ok(separator > 0);
  const episodeName = episode.slice(0, separator);
  const episodeId = episode.slice(separator + 1);
  assert.ok(flag && episodeName && episodeId);
  const play = JSON.parse(spider.play(flag, episodeId, []));
  assert.equal(play.parse, 0);
  assert.equal(play.url, "https://example.com/episode/1");
  assert.equal(category.pagecount, 1);
});

test("filter groups point to category IDs declared in the Result", () => {
  const result = JSON.parse(extract("resultExplore"));
  for (const category of result.class) {
    assert.ok(Array.isArray(result.filters[category.type_id]));
  }
});
