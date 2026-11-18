"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { getPortalAccess, PORTAL_OWNER_ID } from "@/lib/portal-access";
import { createPortalUser, changePortalCredentials, saveUserAccess, type UserManagementResult } from "@/lib/user-management";

async function requireOwner() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || user?.id !== PORTAL_OWNER_ID || !(await getPortalAccess(client)).users) throw new Error("Only the designated owner may manage users.");
  return client;
}
async function run(operation: (client: Awaited<ReturnType<typeof requireOwner>>) => Promise<UserManagementResult>): Promise<UserManagementResult> {
  try {
    const result = await operation(await requireOwner());
    revalidatePath("/users");
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The account operation failed." };
  }
}
export async function createUser(form: FormData) {
  return run(client => createPortalUser(client, createAuthAdminClient(), form));
}
export async function updateCredentials(form: FormData) {
  return run(client => changePortalCredentials(client, createAuthAdminClient(), form));
}
export async function updateAccess(form: FormData) {
  return run(client => saveUserAccess(client, form));
}
