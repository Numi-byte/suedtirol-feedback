import "server-only";
import {
  feedbackUuid,
  parseFeedbackRuntime,
} from "../../../shared/feedback-environment";
import { getFeedbackEnvironmentHeaders } from "./supabase/config";
import { createClient } from "./supabase/server";
import { getPortalAccess, PORTAL_OWNER_ID } from "./portal-access";

export class FeedbackManagementError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function feedbackManagerContext(ownerOnly = false) {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const access = await getPortalAccess(client);
  if (error || !user)
    throw new FeedbackManagementError("Sign in required.", 401);
  if (!access.feedbackSettings || (ownerOnly && user.id !== PORTAL_OWNER_ID))
    throw new FeedbackManagementError(
      "Feedback management access required for this environment.",
      403,
    );
  const context = await client.rpc("get_feedback_runtime_context");
  if (context.error)
    throw new Error(
      "Environment unavailable. Apply the migrations and check the deployment binding.",
    );
  const runtime = parseFeedbackRuntime(context.data);
  return { client, user, access, runtime, owner: user.id === PORTAL_OWNER_ID };
}

/** Never select a backend from user input; compare the submitted identity. */
export function requireSubmittedEnvironment(form: FormData, expected: string) {
  if (
    form.get("environment_id") !== expected ||
    getFeedbackEnvironmentHeaders()["x-feedback-environment"] !== expected
  )
    throw new FeedbackManagementError(
      "The selected environment does not match this deployment. Reopen Feedback Management.",
      403,
    );
  return expected;
}
export function managementUuid(value: unknown): string {
  if (typeof value !== "string" || !feedbackUuid.test(value))
    throw new FeedbackManagementError("Invalid record identifier.", 400);
  return value;
}

type EnvironmentPortal = {
  id: string;
  kind: "production" | "staging" | "testing";
  label: string;
  project_ref: string;
  url: string;
};
export function configuredEnvironmentPortals(): EnvironmentPortal[] {
  const raw = process.env.FEEDBACK_ENVIRONMENT_PORTALS;
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length > 10)
    throw new Error("Invalid environment portal configuration.");
  const ids = new Set<string>(),
    projects = new Set<string>(),
    urls = new Set<string>();
  return entries.map((entry: EnvironmentPortal) => {
    const url = new URL(entry.url);
    if (
      !feedbackUuid.test(entry.id) ||
      !["production", "staging", "testing"].includes(entry.kind) ||
      typeof entry.label !== "string" ||
      !entry.label.trim() ||
      entry.label.length > 100 ||
      !/^[a-z0-9-]{3,100}$/.test(entry.project_ref) ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      ids.has(entry.id) ||
      projects.has(entry.project_ref) ||
      urls.has(url.origin)
    )
      throw new Error(
        "Environments must use distinct Supabase projects and HTTPS portal deployments.",
      );
    ids.add(entry.id);
    projects.add(entry.project_ref);
    urls.add(url.origin);
    return { ...entry, url: url.origin + "/feedback-settings/environments" };
  });
}
