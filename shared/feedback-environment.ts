export const feedbackUuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type FeedbackRuntime = {
  environment_id: string;
  kind: "unconfigured" | "production" | "staging" | "testing";
  label: string;
  project_ref: string | null;
  campaign_id: string | null;
  dataset_version_id: string | null;
  form_version_id: string | null;
  campaign_name: string | null;
  accepting_submissions: boolean;
};

/** Deployment configuration, never a URL parameter, cookie, or form field. */
export function feedbackEnvironmentHeaders(
  url: string,
  id?: string,
  projectRef?: string,
): Record<string, string> {
  if (!id) return {}; // Additive migration stage; initialized databases reject it.
  if (!feedbackUuid.test(id))
    throw new Error("Invalid deployment environment identity.");
  const host = new URL(url).hostname;
  const ref = host.endsWith(".supabase.co") ? host.split(".")[0] : projectRef;
  if (
    !ref ||
    !/^[a-z0-9-]{3,100}$/.test(ref) ||
    (projectRef && ref !== projectRef)
  )
    throw new Error(
      "Supabase project does not match the deployment environment.",
    );
  return {
    "x-feedback-environment": id.toLowerCase(),
    "x-feedback-project": ref,
  };
}

export function parseFeedbackRuntime(value: unknown): FeedbackRuntime {
  if (!value || typeof value !== "object")
    throw new Error("Environment unavailable.");
  const v = value as FeedbackRuntime;
  if (
    !feedbackUuid.test(v.environment_id) ||
    !["unconfigured", "production", "staging", "testing"].includes(v.kind) ||
    typeof v.label !== "string" ||
    typeof v.accepting_submissions !== "boolean" ||
    [v.campaign_id, v.dataset_version_id, v.form_version_id].some(
      (id) => id !== null && !feedbackUuid.test(id),
    )
  )
    throw new Error("Invalid environment context.");
  return v;
}

export function feedbackRuntimeChanged(
  a?: FeedbackRuntime,
  b?: FeedbackRuntime,
) {
  return (
    a?.environment_id !== b?.environment_id ||
    a?.campaign_id !== b?.campaign_id ||
    a?.dataset_version_id !== b?.dataset_version_id ||
    a?.form_version_id !== b?.form_version_id
  );
}
