import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readEfaStopPlaces } from '../src/lib/efa-stop-places.ts';
import { importEfaBatches } from '../src/lib/efa-import-batches.ts';
import { loadAllStopRows } from '../src/lib/all-stop-rows.ts';

const rows = Array.from({ length: 1207 }, (_, i) => ({
  id_version: `(it:apb:StopPlace:it:22021:${i},any)`, stop_id: String(i),
  name_it: `Fermata ${i}`, latitude: 46.5, longitude: 11.3,
}));

test('processes all 1207 matching API records over multiple batches, not just the first ten', async () => {
  const parsed = readEfaStopPlaces({ locations: rows.map((row, i) => ({
    id: `it:22021:${i}`, name: row.name_it, properties: { stopId: row.stop_id },
    coord: [row.latitude, row.longitude],
  })) });
  assert.equal(parsed.matching, 1207);
  const saved = new Map();
  let imported = 0;
  const sizes = [];
  await importEfaBatches(parsed.rows, async batch => {
    sizes.push(batch.length);
    batch.forEach(row => saved.set(row.id_version, row));
    return { data: batch.length, error: null };
  }, n => { imported += n; }, []);
  assert.equal(imported, 1207);
  assert.equal(saved.size, 1207);
  assert.deepEqual(sizes, [250, 250, 250, 250, 207]);
});
test('an atomic batch conflict does not prevent other stops or later batches from importing', async () => {
  const saved = new Set();
  const errors = [];
  let imported = 0;
  await importEfaBatches(rows, async batch => {
    if (batch.some(row => row.stop_id === '8')) return { data: null,
      error: { message: 'Multiple existing stops match EFA place 8.' } };
    batch.forEach(row => saved.add(row.stop_id));
    return { data: batch.length, error: null };
  }, n => { imported += n; }, errors);
  assert.equal(imported, 1206);
  assert.equal(saved.size, 1206);
  assert.ok(saved.has('1206'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /StopPlace:it:22021:8,any/);
});
test('schema/auth failures stop without repeatedly retrying every row', async () => {
  let calls = 0;
  await assert.rejects(() => importEfaBatches(rows, async () => {
    calls++;
    return { data: null, error: { message: 'Authentication required' } };
  }, () => {}, []), /Authentication required/);
  assert.equal(calls, 1);
});
test('database count mismatches cannot be reported as a successful import', async () => {
  await assert.rejects(() => importEfaBatches(rows, async () => ({ data: 10, error: null }), () => {}, []), /invalid EFA import count/);
});
test('the portal loads all rows even with a small server-side cap', async () => {
  const loaded = await loadAllStopRows(async from => ({
    data: rows.slice(from, from + 10), error: null, count: rows.length,
  }));
  assert.deepEqual(loaded, rows);
});
test('portal query errors are surfaced instead of showing an empty or partial database', async () => {
  await assert.rejects(() => loadAllStopRows(async () => ({
    data: null, error: { message: 'offline' }, count: null,
  })), /offline/);
});
