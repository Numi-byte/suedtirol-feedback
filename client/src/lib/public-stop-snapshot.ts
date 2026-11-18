import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { loadPublishedStopPages } from "./published-stop-pages";
import { singleFlight } from "../../../shared/single-flight";

const readSnapshot = unstable_cache(async () => {
  const supabase = createPublicClient();
  return loadPublishedStopPages((from, to) => supabase
    .rpc("list_published_stop_search", {}, { count: "exact" })
    .order("id").range(from, to));
}, ["public-stop-search-snapshot-v2"], { revalidate: 60 });

/** Share one refresh per instance during bursts, in addition to the data cache. */
export const publicStopSnapshot = singleFlight(readSnapshot);
