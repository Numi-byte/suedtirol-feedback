"use server";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { fetchWithTimeout } from "../../../../../shared/fetch-with-timeout";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess, portalHome } from "@/lib/portal-access";
import { getLanguage } from "@/lib/language";
import { passwordCopy } from "@/lib/password-copy";
import { changeOwnPassword } from "@/lib/change-own-password";
export async function changePassword(form: FormData) {
  const copy = passwordCopy[await getLanguage()];
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || !portalHome(await getPortalAccess(client)))
      return { error: copy.session };
    const result = await changeOwnPassword(client, form, async (current) => {
      if (!user.email) return false;
      const { url, publishableKey } = getSupabaseConfig();
      // A separate in-memory session verifies the old password without replacing
      // the signed-in user's cookies, regardless of Auth's optional password policy.
      const verifier = createAuthClient(url, publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchWithTimeout },
      });
      try {
        const { data, error } = await verifier.auth.signInWithPassword({
          email: user.email,
          password: current,
        });
        return !error && data.user?.id === user.id;
      } finally {
        await verifier.auth.signOut({ scope: "local" });
      }
    });
    return result === "success" ? { success: true } : { error: copy[result] };
  } catch {
    return { error: copy.failed };
  }
}
