import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { fetchWithTimeout } from "../../../../shared/fetch-with-timeout";

/** Cacheable public reads must never inherit an administrator's session. */
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithTimeout },
  });
}
