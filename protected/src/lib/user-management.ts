import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTAL_OWNER_ID } from "./portal-access.ts";

export type UserManagementResult = { success?: boolean; error?: string; warning?: string };
export function readAccountFields(form: FormData, creating = false) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if ((creating || password) && (password.length < 12 || password.length > 1024)) throw new Error("Use a password with 12–1024 characters.");
  return { email, password };
}
export function readUserId(form: FormData) {
  const id = String(form.get("user_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid user ID.");
  return id;
}
export function readAccessFields(form: FormData) {
  const flags = { p_active: form.get("active") === "on", p_stops: form.get("stops") === "on", p_database: form.get("database") === "on", p_feedback: form.get("feedback") === "on", p_feedback_settings: form.get("feedback_settings") === "on" };
  const reply = flags.p_feedback && form.get("reply_feedback") === "on";
  if (flags.p_active && !flags.p_stops && !flags.p_database && !flags.p_feedback && !flags.p_feedback_settings) throw new Error("Choose at least one section for an active account.");
  return { ...flags, p_reply_feedback: reply };
}

export async function saveUserAccess(client: SupabaseClient, form: FormData): Promise<UserManagementResult> {
  const id = readUserId(form);
  if (id === PORTAL_OWNER_ID) throw new Error("Owner access cannot be changed.");
  const { error } = await client.rpc("set_portal_user_access", { p_user_id: id, ...readAccessFields(form) });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function createPortalUser(client: SupabaseClient, admin: SupabaseClient, form: FormData): Promise<UserManagementResult> {
  const { email, password } = readAccountFields(form, true);
  const flags = readAccessFields(form);
  // Auth identities alone have no portal rights. Permission assignment is a
  // separate owner-checked transaction; never infer rights from user metadata.
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("The account creation could not be confirmed.");
  const audit = await client.rpc("record_portal_user_event", { p_user_id: data.user.id, p_event: "account_created" });
  const access = await client.rpc("set_portal_user_access", { p_user_id: data.user.id, ...flags });
  if (access.error) return { error: "The account was created, but access could not be confirmed. Find it in the user list and save its permissions before retrying creation." };
  return { success: true, ...(audit.error ? { warning: "Account created; the additional management audit entry could not be saved." } : {}) };
}

export async function changePortalCredentials(client: SupabaseClient, admin: SupabaseClient, form: FormData): Promise<UserManagementResult> {
  const id = readUserId(form);
  const { email, password } = readAccountFields(form);
  const intent = await client.rpc("record_portal_user_event", { p_user_id: id, p_event: "credentials_update_requested" });
  if (intent.error) throw new Error("Could not record the credential change. Please retry.");
  const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true, ...(password ? { password } : {}) });
  if (error) {
    await client.rpc("record_portal_user_event", { p_user_id: id, p_event: "credentials_update_failed" });
    throw new Error(error.message);
  }
  const audit = await client.rpc("record_portal_user_event", { p_user_id: id, p_event: "credentials_updated" });
  return { success: true, ...(audit.error ? { warning: "Credentials updated; the completion audit entry could not be saved." } : {}) };
}
