import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { loadPublishedStopPages } from "./published-stop-pages";
import { singleFlight } from "../../../shared/single-flight";
import { parseFeedbackRuntime } from "../../../shared/feedback-environment";

async function versionKey() {
  const client = createPublicClient();
  const { data, error } = await client.rpc("get_feedback_runtime_context");
  if (error) throw new Error("Environment unavailable.");
  const runtime = parseFeedbackRuntime(data);
  return `${runtime.environment_id}:${runtime.dataset_version_id ?? "paused"}`;
}
const readSnapshot = unstable_cache(async (expectedVersion: string) => {
  if (expectedVersion !== "legacy" && await versionKey() !== expectedVersion) throw new Error("Dataset changed; retry.");
  const supabase = createPublicClient();
  const rows = await loadPublishedStopPages((from, to) => supabase
    .rpc("list_published_stop_search", {}, { count: "exact" })
    .order("id").range(from, to));
  if (expectedVersion !== "legacy" && await versionKey() !== expectedVersion) throw new Error("Dataset changed during loading; retry.");
  return rows;
}, ["public-stop-search-snapshot-v3", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID ?? "legacy"], { revalidate: 60 });

/** Share one refresh per instance during bursts, in addition to the data cache. */
export const publicStopSnapshot = singleFlight(async () => readSnapshot(process.env.NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID ? await versionKey() : "legacy"));
