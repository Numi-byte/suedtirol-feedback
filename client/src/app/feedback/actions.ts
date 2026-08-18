"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const categorySlugs = new Set([
  "weather_protection", "seating", "safe_sidewalk", "safe_crossing",
  "passenger_information", "lighting", "accessibility", "shading",
  "bicycle_parking", "waste_bin",
]);

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const stopId = String(formData.get("stop_id") ?? "");
  const categories = formData.getAll("categories").map(String).filter((slug) => categorySlugs.has(slug));
  const severity = String(formData.get("severity") ?? "medium");
  const description = String(formData.get("description") ?? "").trim();
  const wantsContact = formData.get("consent_to_contact") === "on";
  const email = String(formData.get("email") ?? "").trim();
  const language = String(formData.get("language") ?? "de");

  if (!stopId || categories.length === 0) throw new Error("Bitte wählen Sie mindestens eine Kategorie aus.");
  if (!new Set(["low", "medium", "high"]).has(severity)) throw new Error("Ungültige Problemstärke.");
  if (wantsContact && !email) throw new Error("Bitte geben Sie eine E-Mail-Adresse an.");

  const { data: feedbackId, error } = await supabase.rpc("create_feedback_report", {
    p_bus_stop_id: stopId,
    p_categories: categories,
    p_severity: severity,
    p_description: description || null,
    p_email: wantsContact ? email : null,
    p_consent_to_contact: wantsContact,
    p_language: language,
  });
  if (error) throw new Error(error.message);

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      throw new Error("Das Foto muss JPG, PNG oder WebP und höchstens 10 MB groß sein.");
    }
    const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${feedbackId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("feedback-photos").upload(path, photo, { contentType: photo.type });
    if (uploadError) throw new Error(uploadError.message);
    const { error: photoError } = await supabase.rpc("register_feedback_photo", { p_feedback_id: feedbackId, p_storage_path: path });
    if (photoError) throw new Error(photoError.message);
  }

  // Carried so the thank-you page can show the details and hand them to the
  // südtirolmobil contact form. The email is deliberately left out of the URL.
  const handoff = new URLSearchParams({ lang: language });
  const stopName = String(formData.get("stop_name") ?? "").trim();
  if (stopName) handoff.set("stop", stopName);
  if (categories.length) handoff.set("cats", categories.join(","));
  if (severity) handoff.set("sev", severity);
  if (description) handoff.set("msg", description.slice(0, 500));
  redirect(`/feedback/thanks?${handoff.toString()}`);
}
