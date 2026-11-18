import assert from "node:assert/strict";
import { test } from "node:test";
import { singleFlight } from "./single-flight.ts";

test("a burst of 100 concurrent readers shares one upstream refresh", async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const read = singleFlight(async () => { calls++; await gate; return ["stop"]; });
  const readers = Array.from({ length: 100 }, () => read());
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  for (const result of await Promise.all(readers)) assert.deepEqual(result, ["stop"]);
  await read();
  assert.equal(calls, 2);
});

test("a failed refresh is shared and does not poison subsequent requests", async () => {
  let calls = 0;
  const read = singleFlight(async () => { if (++calls === 1) throw new Error("upstream offline"); return []; });
  const outcomes = await Promise.allSettled(Array.from({ length: 100 }, () => read()));
  assert.ok(outcomes.every(result => result.status === "rejected"));
  assert.equal(calls, 1);
  assert.deepEqual(await read(), []);
  assert.equal(calls, 2);
});
