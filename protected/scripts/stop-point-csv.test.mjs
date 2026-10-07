import assert from "node:assert/strict";
import { test } from "node:test";
import { readStopPointCsv, stopPointIdentity } from "../src/lib/stop-point-csv.ts";

const encode = (row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",");
const readStopPointRows = (rows, onSkipped) => readStopPointCsv(rows.map(encode).join("\r\n"), onSkipped);
const headers = ["id_version", "point_number", "latitude", "longitude", "name_de", "name_it"];
const row = (point = "5352", parent = "468", latitude = 46.6) =>
  [`(it:apb:ScheduledStopPoint:it:22021:${parent}:1:${point},any)`, "1", latitude, 11.4, "Bahnhof", "Stazione"];

test("both example points resolve to the same full stop-place reference", () => {
  const a = stopPointIdentity(row()[0]);
  const b = stopPointIdentity(row("2805")[0]);
  assert.equal(a.stopPlaceRef, "it:apb:StopPlace:it:22021:468");
  assert.equal(a.stopPlaceRef, b.stopPlaceRef);
  assert.notEqual(a.pointRef, b.pointRef);
  assert.notEqual(a.stopPlaceRef, stopPointIdentity(row("5352", "1468")[0]).stopPlaceRef);
});
test("the first row is a header, and multiple points of the same place are retained", () => {
  const points = readStopPointRows([headers, row(), row("2805")]);
  assert.equal(points.length, 2);
  assert.equal(points[0].latitude, 46.6);
  assert.equal(points[0].longitude, 11.4);
  assert.equal(points[0].pointNumber, "1");
});
test("repeat point references update from the last row without duplicating the point", () => {
  const points = readStopPointRows([headers, row(), row("5352", "468", 46.8)]);
  assert.equal(points.length, 1);
  assert.equal(points[0].latitude, 46.8);
});
test("reordered headers and numeric fields are supported", () => {
  const points = readStopPointRows([[...headers].reverse(), [...row()].reverse()]);
  assert.equal(points[0].latitude, 46.6);
  const data = row();
  data[1] = 0;
  data[4] = "";
  assert.equal(readStopPointRows([headers, data])[0].pointNumber, "0");
  assert.equal(readStopPointRows([headers, data])[0].nameDe, "Stazione");
});
test("reports actual CSV row numbers and rejects blanks, bad identifiers and coordinates", () => {
  const invalid = [row(), row("2805"), row("9999"), row("8888")];
  invalid[0][0] = "(it:apb:StopPlace:it:22021:468,any)";
  invalid[1][2] = null;
  invalid[2][3] = 181;
  invalid[3][4] = invalid[3][5] = "";
  const issues = [];
  const points = readStopPointRows([headers, ...invalid, row("valid")], (message) => issues.push(message));
  assert.equal(points.length, 1);
  assert.equal(issues.length, 4);
  assert.ok(issues[0].includes("CSV row 2:"));
  assert.ok(issues[1].includes("invalid latitude"));
});
test("rejects missing or duplicate row-1 headers rather than silently dropping columns", () => {
  assert.throws(() => readStopPointRows([row()]), /Missing CSV columns/);
  assert.throws(() => readStopPointRows([[...headers, "id_version"]]), /duplicate column/);
});
test("keeps a large file's distinct points across import batch boundaries", () => {
  const points = readStopPointRows([headers, ...Array.from({ length: 601 }, (_, i) => row(String(i)))]);
  assert.equal(points.length, 601);
});
test("CSV preserves the comma inside id_version and escaped names with commas and newlines", () => {
  const point = row();
  point[4] = 'Bahnhof, "Nord"\nEingang';
  const source = `\uFEFF${encode(headers)}\r\n${encode(point)}\r\n`;
  const [parsed] = readStopPointCsv(source);
  assert.equal(parsed.idVersion, point[0]);
  assert.equal(parsed.nameDe, point[4]);
});
test("CSV accepts an unquoted header and ordinary numeric fields", () => {
  const source = `${headers.join(",")}\n"${row()[0]}",1,46.6,11.4,Bahnhof,Stazione`;
  const [parsed] = readStopPointCsv(source);
  assert.equal(parsed.latitude, 46.6);
  assert.equal(parsed.longitude, 11.4);
  assert.equal(parsed.pointNumber, "1");
});
test("CSV rejects unterminated quoted fields", () => {
  assert.throws(() => readStopPointCsv(`${headers.join(",")}\n"unfinished`), /unterminated quoted field/);
});
