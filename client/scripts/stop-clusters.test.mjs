import assert from "node:assert/strict";
import { test } from "node:test";
import { createStopClusterIndex, stopClusterDiameter, STOP_CLUSTER_MAX_ZOOM } from "../src/lib/stop-clusters.ts";

const stop = (id, latitude, longitude) => ({
  id: String(id), latitude, longitude, name_de: "Haltestelle", name_it: "Fermata",
  name_en: "Stop", municipality: "", is_accessible: false, feedback_count: 0,
});
const bounds = [10, 45, 13, 48];
const crowded = Array.from({ length: 3429 }, (_, i) =>
  stop(i, 46.4 + Math.floor(i / 60) * 0.003, 11.1 + (i % 60) * 0.003));

test("all places remain accounted for at every zoom; overview renders far fewer markers", () => {
  const index = createStopClusterIndex(crowded);
  for (const zoom of [8, 11, 14, 17, 18, 19]) {
    const features = index.getClusters(bounds, zoom);
    assert.equal(features.reduce((sum, feature) => sum + (feature.properties.cluster ? feature.properties.point_count : 1), 0), crowded.length);
  }
  assert.ok(index.getClusters(bounds, 8).length < crowded.length / 20);
  assert.equal(index.getClusters(bounds, STOP_CLUSTER_MAX_ZOOM + 1).length, crowded.length);
});
test("cluster expansion reveals more places and eventually individual bus stops", () => {
  const index = createStopClusterIndex([stop(1, 46.5, 11.35), stop(2, 46.5005, 11.3505)]);
  const [cluster] = index.getClusters(bounds, 10);
  assert.equal(cluster.properties.point_count, 2);
  const zoom = index.getClusterExpansionZoom(cluster.properties.cluster_id);
  assert.ok(zoom > 10);
  assert.equal(index.getClusters(bounds, zoom).length, 2);
});
test("zoomed-in viewport queries return just the local places", () => {
  const index = createStopClusterIndex(crowded);
  const features = index.getClusters([11.1, 46.4, 11.12, 46.42], 18);
  assert.ok(features.length > 0 && features.length < 100);
});
test("cluster counts reflect the filtered stop-place input only", () => {
  const index = createStopClusterIndex(crowded.slice(0, 25));
  const features = index.getClusters(bounds, 8);
  assert.equal(features.reduce((sum, feature) => sum + (feature.properties.point_count ?? 1), 0), 25);
  assert.deepEqual(createStopClusterIndex([]).getClusters(bounds, 8), []);
});
test("larger counts produce larger blue-circle diameters within readable bounds", () => {
  const sizes = [2, 10, 50, 100, 1000, 3429].map(stopClusterDiameter);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1]);
  assert.ok(sizes[0] >= 36);
  assert.ok(sizes.at(-1) <= 92);
});
