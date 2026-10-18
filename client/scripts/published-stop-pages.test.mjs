import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadPublishedStopPages } from "../src/lib/published-stop-pages.ts";

const stops = Array.from({ length: 2307 }, (_, id) => ({ id: String(id).padStart(5, "0") }));

for (const cap of [10, 250, 1000]) {
  test(`returns all published stops with a PostgREST cap of ${cap}, including stops beyond 1000`, async () => {
    const requested = [];
    // Exercise the real Supabase client and its RPC ordering/range/count protocol.
    const supabase = createClient("https://example.supabase.co", "test-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, options) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/rest/v1/rpc/list_published_stops_with_feedback_count");
        assert.equal(url.searchParams.get("order"), "id.asc");
        assert.match(new Headers(options.headers).get("prefer"), /count=exact/);
        const from = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        assert.equal(limit, 500);
        requested.push(from);
        const page = stops.slice(from, from + Math.min(limit, cap));
        return new Response(JSON.stringify(page), {
          headers: { "Content-Type": "application/json", "Content-Range": `${from}-${from + page.length - 1}/${stops.length}` },
        });
      } },
    });
    const result = await loadPublishedStopPages((from, to) => supabase
      .rpc("list_published_stops_with_feedback_count", {}, { count: "exact" })
      .order("id").range(from, to));
    assert.deepEqual(result, stops);
    assert.equal(new Set(result.map(stop => stop.id)).size, stops.length);
    assert.ok(requested.some(offset => offset >= 1000));
  });
}

test("a later page error fails the request instead of serving a partial map", async () => {
  await assert.rejects(() => loadPublishedStopPages(async from => from === 0
    ? { data: stops.slice(0, 500), error: null, count: stops.length }
    : { data: null, error: { message: "Database unavailable" }, count: null }), /Database unavailable/);
});

test("handles zero published stops", async () => {
  assert.deepEqual(await loadPublishedStopPages(async () => ({ data: [], error: null, count: 0 })), []);
});

test("without a total count, a short capped page does not end pagination", async () => {
  assert.deepEqual(await loadPublishedStopPages(async from => ({
    data: stops.slice(from, from + 100), error: null, count: null,
  })), stops);
});
