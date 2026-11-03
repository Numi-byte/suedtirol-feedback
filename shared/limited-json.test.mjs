import assert from "node:assert/strict";
import { test } from "node:test";
import { limitedJson } from "./limited-json.ts";

test("valid feeds parse, and a false or absent length cannot bypass the streaming limit", async () => {
  assert.deepEqual(await limitedJson(new Response('{"stops":[]}'), 100), { stops: [] });
  for (const headers of [{}, { "Content-Length": "1" }, { "Content-Length": "1000" }]) {
    await assert.rejects(limitedJson(new Response('"' + "x".repeat(100) + '"', { headers }), 50), /size limit/);
  }
});
