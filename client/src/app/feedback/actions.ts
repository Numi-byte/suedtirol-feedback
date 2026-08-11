"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const rating = (name: string) => Number(formData.get(name));
  const { error } = await supabase.from("stop_feedback").insert({
    bus_stop_id: String(formData.get("stop_id")),
    overall_rating: rating("overall_rating"),
    cleanliness_rating: rating("cleanliness_rating"),
    safety_rating: rating("safety_rating"),
    accessibility_rating: rating("accessibility_rating"),
    information_rating: rating("information_rating"),
    shelter_rating: rating("shelter_rating"),
    has_shelter: formData.get("has_shelter") === "yes",
    has_seating: formData.get("has_seating") === "yes",
    has_lighting: formData.get("has_lighting") === "yes",
    comment: String(formData.get("comment") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    consent_to_contact: formData.get("consent_to_contact") === "on",
    language: String(formData.get("language") ?? "de"),
  });
  if (error) throw new Error(error.message);
  redirect(`/feedback/thanks?lang=${encodeURIComponent(String(formData.get("language") ?? "de"))}`);
}
