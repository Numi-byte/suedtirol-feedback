import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { fetchWithTimeout } from "../../../../shared/fetch-with-timeout";

export function hasAuthAdminKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
/** Call only after verifying the fixed owner with the ordinary session client. */
export function createAuthAdminClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key === publishableKey || key.startsWith("sb_publishable_")) throw new Error("Configure the private Supabase admin key in the protected app's server settings.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchWithTimeout } });
}
