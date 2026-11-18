import { feedbackEnvironmentHeaders } from "../../../../shared/feedback-environment";
export function getFeedbackEnvironmentHeaders() {
  return feedbackEnvironmentHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID, process.env.NEXT_PUBLIC_FEEDBACK_PROJECT_REF);
}
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return {
    url,
    publishableKey,
  };
}
