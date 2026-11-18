export const PORTAL_OWNER_ID = "bdee91d9-c969-4bd4-b336-8f7e780ead3e";
export type PortalSection = "feedback" | "stops" | "database" | "users" | "feedbackSettings";
export type PortalAccess = Record<PortalSection, boolean>;
export const NO_PORTAL_ACCESS: PortalAccess = { feedback: false, stops: false, database: false, users: false, feedbackSettings:false };

type AccessClient = { rpc(name: string): PromiseLike<{ data: unknown; error: unknown }> };
export async function getPortalAccess(client: AccessClient): Promise<PortalAccess> {
  const { data, error } = await client.rpc("get_portal_access");
  if (error || !data || typeof data !== "object") return { ...NO_PORTAL_ACCESS };
  const values = data as Record<string, unknown>;
  return { feedback: values.feedback === true, stops: values.stops === true, database: values.database === true, users: values.users === true, feedbackSettings:values.feedbackSettings === true };
}
export function portalHome(access: PortalAccess): string | null {
  if (access.feedback) return "/";
  if (access.stops) return "/stops";
  if (access.database) return "/database";
  if (access.users) return "/users";
  if (access.feedbackSettings) return "/feedback-settings";
  return null;
}
export function portalLinks(access: PortalAccess): { href: string; section: PortalSection }[] {
  return ([{ href: "/", section: "feedback" }, { href: "/stops", section: "stops" }, { href: "/database", section: "database" }, { href: "/users", section: "users" }, { href:"/feedback-settings", section:"feedbackSettings" }] as const).filter(link => access[link.section]);
}
