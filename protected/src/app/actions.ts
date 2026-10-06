"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANGUAGE_COOKIE, getTranslations } from "@/lib/language";
import { languages } from "@/lib/i18n";
import { canReplyToFeedback } from "@/lib/feedback-reply-authorization";
import { createClient } from "@/lib/supabase/server";

export async function setLanguage(formData: FormData) {
  const requested = String(formData.get("language") ?? "");
  const language = languages.find((code) => code === requested);
  if (!language) return;
  (await cookies()).set(LANGUAGE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export type AuthState = { error?: string };

export async function signIn(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { t } = await getTranslations();
  if (!email || !password) return { error: t.login.errorEmpty };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: t.login.errorInvalid };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

type StopFields = {
  name_de: string; name_it: string; name_en: string; municipality: string;
  stop_code: string | null; latitude: number; longitude: number;
  is_accessible: boolean; is_published: boolean;
};

function readStopFields(formData: FormData): StopFields {
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Valid coordinates are required.");
  return {
    name_de: String(formData.get("name_de") ?? "").trim(),
    name_it: String(formData.get("name_it") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    municipality: String(formData.get("municipality") ?? "").trim(),
    stop_code: String(formData.get("stop_code") ?? "").trim() || null,
    latitude,
    longitude,
    is_accessible: formData.get("is_accessible") === "on",
    is_published: formData.get("is_published") === "on",
  };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be authenticated to manage bus stops.");
  return { supabase, user };
}

export type FeedbackReplyState = { error?: string; success?: boolean };

export async function replyToFeedback(_state: FeedbackReplyState, formData: FormData): Promise<FeedbackReplyState> {
  const { supabase, user } = await requireUser();
  if (!canReplyToFeedback(user.id)) return { error: "You are not authorized to reply to public feedback." };
  const feedbackId = String(formData.get("feedback_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!feedbackId) return { error: "A feedback id is required." };
  if (!body || body.length > 2000) return { error: "A reply must contain between 1 and 2000 characters." };

  const { error } = await supabase.rpc("reply_to_feedback", { p_feedback_id: feedbackId, p_body: body });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function createBusStop(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("bus_stops").insert({ ...readStopFields(formData), created_by: user.id });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function updateBusStop(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A bus stop id is required.");

  const { error } = await supabase
    .from("bus_stops")
    .update({ ...readStopFields(formData), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

/**
 * Retiring a stop is a soft delete. stop_feedback references bus_stops with
 * "on delete restrict", so removing the row outright would either be refused by
 * the database or, without that constraint, destroy the reports. Archiving
 * takes the stop off the public map and out of the active list while every
 * report it carries keeps a valid reference to it.
 */
export async function archiveBusStop(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A bus stop id is required.");

  const { error } = await supabase
    .from("bus_stops")
    .update({ archived_at: new Date().toISOString(), is_published: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

export async function restoreBusStop(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A bus stop id is required.");

  const { error } = await supabase
    .from("bus_stops")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export type StopPlaceBatchRow = {
  nameDe: string; nameIt: string; nameEn: string; latitude: number; longitude: number; stopCode: string;
};

export type ImportBatchResult = { imported: number; skipped: number; errors: string[] };

/**
 * Receives normalized stop records rather than an uploaded File. The browser
 * parses the CSV and sends small batches, so the original file is never
 * uploaded to, persisted by, or buffered on the application server.
 */
export async function importStopPlaceBatch(rows: StopPlaceBatchRow[], published: boolean): Promise<ImportBatchResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!Array.isArray(rows) || !rows.length || rows.length > 250) throw new Error("An import batch must contain between 1 and 250 stops.");
    rows.forEach((row) => {
      if (!row.nameDe?.trim() || !row.nameIt?.trim() || !row.nameEn?.trim() || !row.stopCode?.trim() ||
        !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) ||
        row.latitude < -90 || row.latitude > 90 || row.longitude < -180 || row.longitude > 180) {
        throw new Error("The import batch contains invalid stop data.");
      }
    });
    const stopCodes = rows.map((row) => row.stopCode.trim());
    const { data: existingStops, error: existingStopsError } = await supabase
      .from("bus_stops")
      .select("stop_code")
      .in("stop_code", stopCodes);
    if (existingStopsError) throw new Error(existingStopsError.message);

    const existingStopCodes = new Set((existingStops ?? []).map((stop) => stop.stop_code));
    const newRows = rows.filter((row) => !existingStopCodes.has(row.stopCode.trim()));
    if (!newRows.length) return { imported: 0, skipped: rows.length, errors: [] };

    // Reverse-geocoding every row made valid stops disappear whenever the
    // external service rate-limited or timed out. Municipality is absent from
    // stop_place.csv and is allowed to be blank, so it must not gate imports.
    for (let offset = 0; offset < newRows.length; offset += 250) {
      const values = newRows.slice(offset, offset + 250).map((stop) => ({
        name_de: stop.nameDe, name_it: stop.nameIt, name_en: stop.nameEn,
        municipality: "", stop_code: stop.stopCode,
        // stop_place centroid_location is (longitude,latitude,). The parser
        // names both values explicitly and they are persisted in their
        // respective database columns here.
        latitude: stop.latitude, longitude: stop.longitude,
        is_published: published, archived_at: null, created_by: user.id,
        updated_at: new Date().toISOString(),
      }));
      // A concurrent import may have inserted a code since the lookup above.
      // Ignore that conflict rather than modifying or duplicating the stop.
      const { error } = await supabase.from("bus_stops").upsert(values, { onConflict: "stop_code", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/");
    revalidatePath("/api/stops");
    return { imported: newRows.length, skipped: existingStopCodes.size, errors: [] };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The CSV batch could not be imported.");
  }
}
