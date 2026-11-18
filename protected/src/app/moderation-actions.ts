"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess } from "@/lib/portal-access";
import {
  managementUuid,
  requireSubmittedEnvironment,
} from "@/lib/feedback-environments";
import { parseFeedbackRuntime } from "../../../shared/feedback-environment";
export async function moderateReport(form: FormData) {
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || !(await getPortalAccess(client)).feedback)
      throw new Error("Feedback access required.");
    const context = await client.rpc("get_feedback_runtime_context");
    if (context.error) throw new Error("Environment unavailable.");
    const runtime = parseFeedbackRuntime(context.data);
    requireSubmittedEnvironment(form, runtime.environment_id);
    const result = await client.rpc("moderate_feedback", {
      p_environment: runtime.environment_id,
      p_feedback: managementUuid(form.get("feedback_id")),
      p_status: String(form.get("status")),
      p_visibility: String(form.get("visibility") ?? "") || null,
      p_notes: String(form.get("notes") ?? ""),
      p_verified: form.get("verified") === "on",
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Moderation failed.",
    };
  }
}
