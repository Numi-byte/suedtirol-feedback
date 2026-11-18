import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, getFeedbackEnvironmentHeaders } from "./config";

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey, { global: { headers: getFeedbackEnvironmentHeaders() } });
}
