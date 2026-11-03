type StaffClient = {
  rpc(name: "is_portal_staff"): PromiseLike<{ data: unknown; error: unknown }>;
};

/** Authentication alone never grants access to private reports or mutations. */
export async function isPortalStaff(supabase: StaffClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_portal_staff");
  return !error && data === true;
}
