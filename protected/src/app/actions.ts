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
import { EFA_STOP_LIST_URL, readEfaStopPlaces } from "@/lib/efa-stop-places";
import { importEfaBatches } from "@/lib/efa-import-batches";
import { getPortalAccess, portalHome, type PortalSection } from "@/lib/portal-access";
import { limitedJson } from "../../../shared/limited-json";
import type { StopMutationResult } from "@/lib/database-navigation";

export async function importEfaStopPlaces(): Promise<{ message: string; error?: boolean; details: string[] }> {
  let imported = 0;
  const details: string[] = [];
  try {
    const { supabase } = await requireUser("stops");
    const response = await fetch(EFA_STOP_LIST_URL, { cache: "no-store", signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`EFA returned HTTP ${response.status}.`);
    const { rows, errors, excluded, duplicates, received, matching } = readEfaStopPlaces(await limitedJson(response, 20 * 1024 * 1024));
    details.push(...errors);
    if (!rows.length) throw new Error("EFA returned no valid South Tyrol stop places. See the import report for details.");
    await importEfaBatches(rows, async batch => {
      const { data, error } = await supabase.rpc("import_efa_stop_place_batch", { p_rows: batch });
      return { data, error };
    }, count => { imported += count; }, details);
    return { error: details.length > 0, details,
      message: `Received ${received} API records; ${matching} IDs start with it:22021:. ${imported} unique stop places inserted or updated and unpublished; ${duplicates} duplicate records ignored; ${excluded} out-of-scope records excluded. ${details.length ? `Import incomplete: ${details.length} issues. Download the report for all affected IDs.` : "All eligible records imported."} The stop list displays 10 stops per page.` };
  } catch (error) {
    return { error: true, details, message: `${imported} stop places saved before the import stopped. ${error instanceof Error ? error.message : "The EFA import failed."} Retrying is safe.` };
  } finally {
    if (imported) revalidatePath("/", "layout");
  }
}

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
  if (email.length > 320 || password.length > 1024) return { error: t.login.errorInvalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: t.login.errorInvalid };
  const access = await getPortalAccess(supabase);
  const home = portalHome(access);
  if (!home) {
    await supabase.auth.signOut();
    return { error: t.login.errorInvalid };
  }

  revalidatePath("/", "layout");
  redirect(home);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

type StopFields = {
  name_de: string; name_it: string; name_en: string; municipality: string; municipality_de: string; municipality_it: string;
  stop_code: string | null; latitude: number; longitude: number;
  is_accessible: boolean; is_published: boolean;
};

function readStopFields(formData: FormData): StopFields {
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Valid coordinates are required.");
  const municipalityDe = String(formData.get("municipality_de") ?? "").trim();
  const municipalityIt = String(formData.get("municipality_it") ?? "").trim();
  if (!municipalityDe || !municipalityIt) throw new Error("German and Italian municipality names are required.");
  return {
    name_de: String(formData.get("name_de") ?? "").trim(),
    name_it: String(formData.get("name_it") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    municipality: municipalityIt,
    municipality_de: municipalityDe,
    municipality_it: municipalityIt,
    stop_code: String(formData.get("stop_code") ?? "").trim() || null,
    latitude,
    longitude,
    is_accessible: formData.get("is_accessible") === "on",
    is_published: formData.get("is_published") === "on",
  };
}

async function requireUser(section: PortalSection) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be authenticated to manage bus stops.");
  if (!(await getPortalAccess(supabase))[section]) throw new Error("You do not have access to this section.");
  return { supabase, user };
}

export type FeedbackReplyState = { error?: string; success?: boolean };

export async function replyToFeedback(_state: FeedbackReplyState, formData: FormData): Promise<FeedbackReplyState> {
  const { supabase } = await requireUser("feedback");
  if (!(await canReplyToFeedback(supabase))) return { error: "You are not authorized to reply to public feedback." };
  const feedbackId = String(formData.get("feedback_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!feedbackId) return { error: "A feedback id is required." };
  if (!body || body.length > 2000) return { error: "A reply must contain between 1 and 2000 characters." };

  const { error } = await supabase.rpc("reply_to_feedback", { p_feedback_id: feedbackId, p_body: body });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: true };
}

/** All edits retain server-side staff checks and return inline feedback. */
async function mutateStop(operation: (context: Awaited<ReturnType<typeof requireUser>>) => Promise<StopMutationResult>): Promise<StopMutationResult> {
  try {
    const result = await operation(await requireUser("database"));
    revalidatePath("/database");
    return { ...result, success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The change could not be saved." };
  }
}

export async function createBusStop(formData: FormData): Promise<StopMutationResult> {
  return mutateStop(async ({ supabase, user }) => {
    const { data, error } = await supabase.from("bus_stops")
      .insert({ ...readStopFields(formData), created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    return { createdId: data.id };
  });
}

export async function updateBusStop(formData: FormData): Promise<StopMutationResult> {
  return mutateStop(async ({ supabase }) => {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("A bus stop id is required.");
    const { error } = await supabase.from("bus_stops")
      .update({ ...readStopFields(formData), updated_at: new Date().toISOString() })
      .eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
    return {};
  });
}

export async function updateStopPointType(formData: FormData): Promise<StopMutationResult> {
  return mutateStop(async ({ supabase }) => {
    const id = String(formData.get("point_id") ?? "");
    const placeId = String(formData.get("place_id") ?? "");
    const transportType = String(formData.get("transport_type") ?? "");
    if (!id || !placeId || !["bus", "train", "cable_car"].includes(transportType)) throw new Error("Invalid stop point or transport type.");
    const { error } = await supabase.from("stop_points")
      .update({ transport_type: transportType, updated_at: new Date().toISOString() })
      .eq("id", id).eq("stop_place_id", placeId).select("id").single();
    if (error) throw new Error(error.message);
    return {};
  });
}

/** Soft-delete stops so reports and their original references remain intact. */
export async function archiveBusStop(formData: FormData): Promise<StopMutationResult> {
  return mutateStop(async ({ supabase }) => {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("A bus stop id is required.");
    const { error } = await supabase.from("bus_stops")
      .update({ archived_at: new Date().toISOString(), is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
    return { archivedId: id };
  });
}

export async function restoreBusStop(formData: FormData): Promise<StopMutationResult> {
  return mutateStop(async ({ supabase }) => {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("A bus stop id is required.");
    const { error } = await supabase.from("bus_stops")
      .update({ archived_at: null, updated_at: new Date().toISOString() })
      .eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
    return {};
  });
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
    const { supabase } = await requireUser("stops");
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
    revalidatePath("/", "layout");
    revalidatePath("/api/stops");
    return { imported: data, skipped: rows.length - data, errors: [] };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The CSV batch could not be imported.");
  }
}

export type StopPointBatchResult = { imported: number; unmatched: number; errors: string[] };

export async function importStopPointBatch(rows: StopPointImportRow[]): Promise<StopPointBatchResult> {
  const { supabase } = await requireUser("stops");
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
  revalidatePath("/", "layout");
  return data as StopPointBatchResult;
}
