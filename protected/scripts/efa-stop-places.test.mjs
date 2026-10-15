import assert from "node:assert/strict";
import { test } from "node:test";
import { readEfaStopPlaces } from "../src/lib/efa-stop-places.ts";

const stop = (overrides = {}) => ({
  isGlobalId: true, id: "it:22021:2139", name: "Via Lancia SEAB", type: "stop",
  parent: { name: "Bolzano", id: "1", type: "locality" },
  properties: { stopId: "66002139" }, coord: [46.484588, 11.336849], ...overrides,
});
const read = (...locations) => readEfaStopPlaces({ locations });

test("maps the complete source ID, main Italian name, stopId and lat/lon without parent names", () => {
  assert.deepEqual(read(stop()).rows, [{
    id_version: "(it:apb:StopPlace:it:22021:2139,any)", stop_id: "66002139",
    name_it: "Via Lancia SEAB", latitude: 46.484588, longitude: 11.336849,
  }]);
});
test("filters other regions, partial prefixes, child points and non-stop entries", () => {
  const result = read(stop(), ...["it:22022:2139", "it:220210:2139", "it:22021:2139:1", "xit:22021:1"].map(id => stop({ id })), stop({ type: "locality" }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.excluded, 5);
});
test("retains long full identifiers without numeric conversion or truncation", () => {
  assert.equal(read(stop({ id: "it:22021:000123456789123456789" })).rows[0].id_version,
    "(it:apb:StopPlace:it:22021:000123456789123456789,any)");
});
test("deduplicates identical records and rejects conflicting identities before import", () => {
  assert.equal(read(stop(), stop()).duplicates, 1);
  assert.equal(read(stop(), stop()).rows.length, 1);
  assert.throws(() => read(stop(), stop({ name: "Different" })), /Conflicting/);
  assert.throws(() => read(stop(), stop({ id: "it:22021:311" })), /multiple places/);
});
test("reports invalid eligible rows instead of fabricating names, IDs or coordinates", () => {
  for (const overrides of [{ name: " " }, { name: null }, { properties: {} }, { coord: null },
    { coord: [null, 11] }, { coord: ["46", 11] }, { coord: [NaN, 11] }, { coord: [91, 11] }, { coord: [46, 181] }]) {
    const result = read(stop(overrides));
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors.length, 1);
  }
});
test("rejects malformed feeds and accepts empty lists explicitly", () => {
  for (const input of [null, [], {}, { locations: {} }]) assert.throws(() => readEfaStopPlaces(input), /locations/);
  assert.deepEqual(read().rows, []);
});
