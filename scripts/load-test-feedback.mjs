#!/usr/bin/env node

import process from "node:process";

const DEFAULT_REQUESTS = 150;
const DEFAULT_WINDOW_MS = 500;
const DEFAULT_TIMEOUT_MS = 30_000;

function positiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function percentile(sortedValues, percentage) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentage / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

async function submit({ endpoint, publishableKey, stopId, timeoutMs, sequence }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
        "X-Client-Info": "suedtirol-feedback-load-test/1.0",
      },
      body: JSON.stringify({
        p_bus_stop_id: stopId,
        p_categories: ["passenger_information"],
        p_severity: "low",
        p_description: `Capacity test request ${sequence}`,
        p_email: null,
        p_consent_to_contact: false,
        p_language: "de",
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      body: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const supabaseUrl = required("LOAD_TEST_SUPABASE_URL").replace(/\/$/, "");
  const publishableKey = required("LOAD_TEST_SUPABASE_PUBLISHABLE_KEY");
  const stopId = required("LOAD_TEST_STOP_ID");
  const requestCount = positiveInteger("LOAD_TEST_REQUESTS", DEFAULT_REQUESTS);
  const windowMs = positiveInteger("LOAD_TEST_WINDOW_MS", DEFAULT_WINDOW_MS);
  const timeoutMs = positiveInteger("LOAD_TEST_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const endpoint = `${supabaseUrl}/rest/v1/rpc/create_feedback_report`;

  console.log(`Sending ${requestCount} feedback reports within ${windowMs} ms...`);
  const testStartedAt = performance.now();
  const requests = Array.from({ length: requestCount }, (_, index) => {
    const delayMs = requestCount === 1 ? 0 : Math.floor((index * windowMs) / requestCount);
    return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() =>
      submit({ endpoint, publishableKey, stopId, timeoutMs, sequence: index + 1 }),
    );
  });
  const results = await Promise.all(requests);
  const elapsedMs = Math.round(performance.now() - testStartedAt);
  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);

  console.log([
    `Completed: ${successes.length}/${requestCount}`,
    `Elapsed: ${elapsedMs} ms`,
    `Throughput: ${((requestCount / elapsedMs) * 1000).toFixed(1)} requests/s`,
    `Latency p50/p95/p99/max: ${percentile(durations, 50)}/${percentile(durations, 95)}/${percentile(durations, 99)}/${durations.at(-1) ?? 0} ms`,
  ].join("\n"));

  if (failures.length > 0) {
    const failureGroups = new Map();
    for (const failure of failures) {
      const key = `${failure.status}: ${failure.body.slice(0, 300)}`;
      failureGroups.set(key, (failureGroups.get(key) ?? 0) + 1);
    }
    console.error("Failures:");
    for (const [failure, count] of failureGroups) console.error(`  ${count}x ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
