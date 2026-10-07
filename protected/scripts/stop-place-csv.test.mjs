import assert from "node:assert/strict";
import { test } from "node:test";
import { readStopPlaceCsv } from "../src/lib/stop-place-csv.ts";

const columns = ["tid", "publication_timestamp", "id_version", "valid_between_from_date",
    "valid_between_to_date", "name_it", "name_de", "short_name_it", "centroid_location",
    "topographic_place_ref", "private_code"];
const encode = (values) => values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
const row = ({ code = "1361", date = "2026-10-01T12:00:00Z", de = "Haltestelle", it = "Fermata", version = "any", location = "(11.3,46.5,)" } = {}) =>
    [1, date, `(it:apb:StopPlace:it:22021:${code},${version})`, "", "", it, de, "", location, "", code];
const csv = (...rows) => [encode(columns), ...rows.map(encode)].join("\r\n");

test("preserves the entire third field and quoted commas, quotes and newlines", () => {
    const [stop] = readStopPlaceCsv(csv(row({ de: 'Ort, "Bahnhof"\nNord' })));
    assert.equal(stop.idVersion, "(it:apb:StopPlace:it:22021:1361,any)");
    assert.equal(stop.nameDe, 'Ort, "Bahnhof"\nNord');
    assert.equal(stop.latitude, 46.5);
    assert.equal(stop.longitude, 11.3);
});
test("keeps the newest publication for every last-column stop code, regardless of order", () => {
    const stops = readStopPlaceCsv(csv(row({ date: "2026-10-02", de: "New" }),
        row({ date: "2026-10-01", de: "Old" }), row({ code: "2000" })));
    assert.equal(stops.length, 2);
    assert.equal(stops[0].nameDe, "New");
    assert.equal(stops[0].publicationTimestamp, "2026-10-02T00:00:00.000Z");
});
test("imports a stop with only one available language rather than discarding it", () => {
    const [stop] = readStopPlaceCsv(csv(row({ de: "" })));
    assert.deepEqual([stop.nameDe, stop.nameIt, stop.nameEn], ["Fermata", "Fermata", "Fermata"]);
});
test("reports invalid rows and continues importing valid stops", () => {
    const errors = [];
    const stops = readStopPlaceCsv(csv(row({ location: "invalid" }), row({ date: "invalid" }),
        row({ code: "" }), row({ code: "valid" })), (message) => errors.push(message));
    assert.equal(stops.length, 1);
    assert.equal(errors.length, 3);
});
test("supports headerless data and reordered named columns", () => {
    assert.equal(readStopPlaceCsv(encode(row()))[0].stopCode, "1361");
    const order = [...columns.keys()].reverse();
    const source = [encode(order.map((i) => columns[i])), encode(order.map((i) => row()[i]))].join("\n");
    assert.equal(readStopPlaceCsv(source)[0].idVersion, "(it:apb:StopPlace:it:22021:1361,any)");
});
test("supports a quoted whole header and rejects unterminated quoted data", () => {
    assert.equal(readStopPlaceCsv(`${encode([columns.join(",")])}\n${encode(row())}`).length, 1);
    assert.throws(() => readStopPlaceCsv('"unfinished'), /unterminated/);
});
test("retains all distinct stops across browser batch boundaries", () => {
    const rows = Array.from({ length: 601 }, (_, index) => row({ code: String(index) }));
    assert.equal(readStopPlaceCsv(csv(...rows, ...rows)).length, 601);
});
test("accepts the reported centroids with zero altitude, including headerless exports", () => {
    for (const location of ["(12.193910121337902,46.734178474883088,0)", "(11.169609830019484,46.8325441419889,0)"]) {
        for (const source of [csv(row({ location })), encode(row({ location }))]) {
            const errors = [];
            const [stop] = readStopPlaceCsv(source, (message) => errors.push(message));
            const [longitude, latitude] = location.slice(1, -1).split(",").map(Number);
            assert.equal(stop.longitude, longitude);
            assert.equal(stop.latitude, latitude);
            assert.equal(errors.length, 0);
        }
    }
});
test("accepts optional numeric altitude and scientific coordinates without swapping axes", () => {
    for (const location of ["(11.3,46.5)", "(11.3,46.5,)", "(11.3,46.5,1200.5)", "(+1.13e1,4.65e1,-20)"]) {
        const [stop] = readStopPlaceCsv(csv(row({ location })));
        assert.equal(stop.longitude, 11.3);
        assert.equal(stop.latitude, 46.5);
    }
});
test("reports every malformed coordinate with its value and row number", () => {
    const locations = ["(,46.5,0)", "(11.3,46.5,bad)", "(11.3,46.5,0,0)", "(Infinity,46.5,0)", "(11.3,1e999,0)"];
    const errors = [];
    assert.equal(readStopPlaceCsv(csv(...locations.map((location) => row({ location }))), (message) => errors.push(message)).length, 0);
    assert.equal(errors.length, locations.length);
    errors.forEach((message, index) => {
        assert.ok(message.includes(`CSV data row ${index + 1}:`));
        assert.ok(message.includes(JSON.stringify(locations[index])));
    });
});
