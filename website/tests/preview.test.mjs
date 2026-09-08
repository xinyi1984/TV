import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { basePath } from "../app/site-config.ts";
import { createPreviewServer } from "../scripts/preview.mjs";

test("static preview serves real files and redirects directory URLs without an SPA fallback", async (t) => {
  const server = createPreviewServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const route of ["/", "/config/", "/spider/", "/local/", "/features/"]) {
    const response = await fetch(origin + basePath + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(await response.text(), /影視TV/);
  }
  for (const path of [basePath + "/config", ...(basePath ? [basePath] : [])]) {
    const response = await fetch(origin + path + "?check=1", {
      redirect: "manual",
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), path + "/?check=1");
  }
  assert.equal((await fetch(origin + basePath + "/missing/")).status, 404);
  if (basePath) assert.equal((await fetch(origin + "/other/")).status, 404);
  const asset = await fetch(origin + basePath + "/logo.svg", {
    method: "HEAD",
  });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /image\/svg\+xml/);
  assert.equal(await asset.text(), "");
});
