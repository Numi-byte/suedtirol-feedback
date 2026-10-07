"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANGUAGE_COOKIE, getTranslations } from "@/lib/language";
import { languages } from "@/lib/i18n";
import { canReplyToFeedback } from "@/lib/feedback-reply-authorization";
import { createClient } from "@/lib/supabase/server";
import type { StopPlaceImportRow } from "@/lib/stop-place-csv";
import type { StopPointImportRow } from "@/lib/stop-point-csv";
import { stopPointIdentity } from "@/lib/stop-point-csv";

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

export type StopPlaceBatchRow = StopPlaceImportRow;

export type ImportBatchResult = { imported: number; skipped: number; errors: string[] };

/**
 * Receives normalized stop records rather than an uploaded File. The browser
 * parses the CSV and sends small batches, so the original file is never
 * uploaded to, persisted by, or buffered on the application server.
 */
export async function importStopPlaceBatch(rows: StopPlaceBatchRow[], published: boolean): Promise<ImportBatchResult> {
  try {
    const { supabase } = await requireUser();
    if (!Array.isArray(rows) || !rows.length || rows.length > 250) throw new Error("An import batch must contain between 1 and 250 stops.");
    rows.forEach((row) => {
      if (!row.nameDe?.trim() || !row.nameIt?.trim() || !row.nameEn?.trim() || !row.stopCode?.trim() ||
        !row.idVersion?.trim() || !Number.isFinite(Date.parse(row.publicationTimestamp)) ||
        !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) ||
        row.latitude < -90 || row.latitude > 90 || row.longitude < -180 || row.longitude > 180) {
        throw new Error("The import batch contains invalid stop data.");
      }
    });
    // The database compares source timestamps atomically, so a concurrent or
    // older upload cannot overwrite a newer version. Existing UUIDs and staff
    // settings are preserved, including stops that already carry feedback.
    const { data, error } = await supabase.rpc("import_stop_place_batch", {
      p_rows: rows.map((stop) => ({
        name_de: stop.nameDe.trim(), name_it: stop.nameIt.trim(), name_en: stop.nameEn.trim(),
        stop_code: stop.stopCode.trim(), id_version: stop.idVersion.trim(),
        publication_timestamp: stop.publicationTimestamp,
        latitude: stop.latitude, longitude: stop.longitude,
      })),
      p_published: published,
    });
    if (error) throw new Error(error.message);
    if (!Number.isInteger(data) || data < 0 || data > rows.length) {
      throw new Error("The database returned an invalid import count.");
    }
    revalidatePath("/");
    revalidatePath("/api/stops");
    return { imported: data, skipped: rows.length - data, errors: [] };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The CSV batch could not be imported.");
  }
}

export type StopPointBatchResult = { imported: number; unmatched: number; errors: string[] };

export async function importStopPointBatch(rows: StopPointImportRow[]): Promise<StopPointBatchResult> {
  const { supabase } = await requireUser();
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 250) throw new Error("An import batch must contain between 1 and 250 points.");
  for (const row of rows) {
    if (!stopPointIdentity(row.idVersion) || !row.pointNumber?.trim() || !row.nameDe?.trim() || !row.nameIt?.trim() ||
      !Number.isFinite(row.latitude) || row.latitude < -90 || row.latitude > 90 ||
      !Number.isFinite(row.longitude) || row.longitude < -180 || row.longitude > 180) {
      throw new Error("The import batch contains invalid stop-point data.");
    }
  }
  const { data, error } = await supabase.rpc("import_stop_point_batch", {
    p_rows: rows.map((row) => ({
      id_version: row.idVersion.trim(), point_number: row.pointNumber.trim(),
      latitude: row.latitude, longitude: row.longitude, name_de: row.nameDe.trim(), name_it: row.nameIt.trim(),
    })),
  });
  if (error) throw new Error(error.message);
  if (!data || !Number.isInteger(data.imported) || !Number.isInteger(data.unmatched) ||
    data.imported < 0 || data.unmatched < 0 || data.imported + data.unmatched !== rows.length ||
    !Array.isArray(data.errors) || !data.errors.every((message: unknown) => typeof message === "string")) {
    throw new Error("The database returned an invalid stop-point import result.");
  }
  revalidatePath("/");
  return data as StopPointBatchResult;
}
