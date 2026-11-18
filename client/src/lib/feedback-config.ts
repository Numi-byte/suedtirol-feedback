import { createPublicClient } from "./supabase/public";
import { parseFeedbackFormConfig } from "../../../shared/feedback-form-config";
export async function getFeedbackConfig() {
  const { data, error } = await createPublicClient().rpc(
    "get_feedback_form_config",
  );
  if (error)
    throw new Error("Feedback configuration is temporarily unavailable.");
  return parseFeedbackFormConfig(data);
}
