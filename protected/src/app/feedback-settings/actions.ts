"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess } from "@/lib/portal-access";
import { sanitizeCategorySvg } from "@/lib/sanitize-category-svg";
import { SVG_MAX_BYTES } from "../../../../shared/safe-feedback-icon";

async function managerClient() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !(await getPortalAccess(client)).feedbackSettings)
    throw new Error("Feedback management access required.");
  return client;
}
export async function savePhotoSettings(form: FormData) {
  try {
    const client = await managerClient();
    const megabytes = Number(form.get("max_photo_mb"));
    if (!Number.isInteger(megabytes) || megabytes < 1 || megabytes > 10)
      throw new Error("Choose a photo limit from 1 to 10 MiB.");
    const { error } = await client.rpc("set_feedback_photo_settings", {
      p_enabled: form.get("photos_enabled") === "on",
      p_max_bytes: megabytes * 1024 * 1024,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/feedback-settings");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save photo settings.",
    };
  }
}
export async function saveCategory(form: FormData) {
  try {
    const client = await managerClient();
    const file = form.get("icon_file");
    const remove = form.get("remove_icon") === "on";
    let icon = null;
    let replace = remove;
    if (file instanceof File && file.size > 0) {
      if (remove)
        throw new Error("Choose an upload or remove the icon, not both.");
      if (
        file.size > SVG_MAX_BYTES ||
        !file.name.toLowerCase().endsWith(".svg")
      )
        throw new Error("Upload an SVG of at most 16 KiB.");
      icon = sanitizeCategorySvg(await file.text());
      replace = true;
    }
    const { error } = await client.rpc("save_feedback_category", {
      p_slug: String(form.get("slug") ?? "").trim(),
      p_label_de: String(form.get("label_de") ?? "").trim(),
      p_label_it: String(form.get("label_it") ?? "").trim(),
      p_label_en: String(form.get("label_en") ?? "").trim(),
      p_active: form.get("is_active") === "on",
      p_position: null,
      p_icon: icon,
      p_replace_icon: replace,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/feedback-settings");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save category.",
    };
  }
}

export async function saveCategoryOrder(slugs: string[], expected: string[]) {
  try {
    const client = await managerClient();
    if (
      ![slugs, expected].every(
        (list) =>
          Array.isArray(list) &&
          list.length >= 1 &&
          list.length <= 50 &&
          list.every(
            (slug) =>
              typeof slug === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(slug),
          ),
      )
    ) {
      return { error: "failed" as const };
    }
    const { error } = await client.rpc("reorder_feedback_categories", {
      p_slugs: slugs,
      p_expected_slugs: expected,
    });
    if (error?.code === "40001") revalidatePath("/feedback-settings");
    if (error)
      return {
        error:
          error.code === "40001"
            ? ("changed" as const)
            : error.code === "42501"
              ? ("denied" as const)
              : ("failed" as const),
      };
    revalidatePath("/feedback-settings");
    return { success: true as const };
  } catch {
    return { error: "denied" as const };
  }
}
