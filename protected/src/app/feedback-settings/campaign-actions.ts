"use server";
import { revalidatePath } from "next/cache";
import {
  feedbackManagerContext,
  managementUuid,
  requireSubmittedEnvironment,
} from "@/lib/feedback-environments";
import { getFeedbackEnvironmentHeaders } from "@/lib/supabase/config";
import type { UserManagementResult } from "@/lib/user-management";

async function mutate(
  form: FormData,
  operation: string,
  owner = false,
): Promise<UserManagementResult> {
  try {
    const { client, runtime } = await feedbackManagerContext(owner);
    const environment = requireSubmittedEnvironment(
      form,
      runtime.environment_id,
    );
    const base = { p_environment: environment };
    let args: Record<string, unknown> = base;
    switch (operation) {
      case "initialize_feedback_environment": {
        if (runtime.kind !== "unconfigured")
          throw new Error("This environment is already fixed.");
        args = {
          ...base,
          p_kind: String(form.get("kind")),
          p_label: String(form.get("label") ?? "").trim(),
          p_project_ref: getFeedbackEnvironmentHeaders()["x-feedback-project"],
        };
        break;
      }
      case "snapshot_feedback_stop_dataset":
        args = { ...base, p_label: String(form.get("label") ?? "").trim() };
        break;
      case "create_feedback_campaign":
        args = {
          ...base,
          p_name: String(form.get("name") ?? "").trim(),
          p_purpose: String(form.get("purpose")),
          p_dataset: managementUuid(form.get("dataset_id")),
          p_starts_at: dateField(form, "starts_at"),
          p_ends_at: dateField(form, "ends_at"),
          p_require_export: true,
        };
        break;
      case "transition_feedback_campaign":
        args = {
          ...base,
          p_campaign: managementUuid(form.get("campaign_id")),
          p_state: String(form.get("state")),
        };
        break;
      case "publish_feedback_production":
        if (form.get("confirm_publication") !== "on")
          throw new Error("Confirm production publication.");
        args = { ...base, p_dataset: managementUuid(form.get("dataset_id")) };
        break;
      case "pause_feedback_publication":
        break;
      case "schedule_feedback_cleanup":
        args = {
          ...base,
          p_campaign: managementUuid(form.get("campaign_id")),
          p_after: dateField(form, "scheduled_at", true),
          p_confirmation: String(form.get("confirmation") ?? ""),
        };
        break;
      case "cancel_feedback_cleanup":
        args = { ...base, p_job: managementUuid(form.get("job_id")) };
        break;
      case "confirm_feedback_evaluation_export":
        if (form.get("saved_copy") !== "on")
          throw new Error("Confirm that you saved and checked the export.");
        args = {
          ...base,
          p_export: managementUuid(form.get("export_id")),
          p_sha256: String(form.get("sha256") ?? ""),
        };
        break;
      case "set_feedback_evaluation_exclusion":
        args = {
          ...base,
          p_feedback: managementUuid(form.get("feedback_id")),
          p_excluded: form.get("excluded") === "on",
          p_reason: String(form.get("reason") ?? "").trim(),
        };
        break;
      default:
        throw new Error("Invalid operation.");
    }
    const { error } = await client.rpc(operation, args);
    if (error) throw new Error(error.message);
    revalidatePath("/feedback-settings", "layout");
    revalidatePath("/");
    revalidatePath("/database");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save the environment change.",
    };
  }
}
// datetime-local values are accompanied by the browser's explicit UTC offset.
function dateField(
  form: FormData,
  name: string,
  required = false,
): string | null {
  const value = String(form.get(name) ?? "");
  if (!value && !required) return null;
  const offset = Number(
    form.get(name === "ends_at" ? "ends_at_offset" : "timezone_offset"),
  );
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !Number.isInteger(offset) ||
    Math.abs(offset) > 840
  )
    throw new Error("Choose a valid date and time.");
  const parsed = Date.parse(value + "Z") + offset * 60_000;
  if (!Number.isFinite(parsed)) throw new Error("Invalid date.");
  return new Date(parsed).toISOString();
}
export async function initializeEnvironment(form: FormData) {
  return mutate(form, "initialize_feedback_environment", true);
}
export async function snapshotDataset(form: FormData) {
  return mutate(form, "snapshot_feedback_stop_dataset");
}
export async function createCampaign(form: FormData) {
  return mutate(form, "create_feedback_campaign");
}
export async function transitionCampaign(form: FormData) {
  return mutate(form, "transition_feedback_campaign");
}
export async function publishProduction(form: FormData) {
  return mutate(form, "publish_feedback_production", true);
}
export async function pausePublication(form: FormData) {
  return mutate(form, "pause_feedback_publication", true);
}
export async function scheduleCleanup(form: FormData) {
  return mutate(form, "schedule_feedback_cleanup", true);
}
export async function cancelCleanup(form: FormData) {
  return mutate(form, "cancel_feedback_cleanup", true);
}
export async function confirmEvaluationExport(form: FormData) {
  return mutate(form, "confirm_feedback_evaluation_export", true);
}
export async function saveEvaluationExclusion(form: FormData) {
  return mutate(form, "set_feedback_evaluation_exclusion");
}
