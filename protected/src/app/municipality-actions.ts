"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess } from "@/lib/portal-access";
import { EFA_STOP_LIST_URL } from "@/lib/efa-stop-places";
import { limitedJson } from "../../../shared/limited-json";
import { municipalityByOmc } from "@/lib/municipality-reference";
import { planMunicipalityBackfill, type MissingMunicipalityStop, type MunicipalityCandidate } from "@/lib/municipality-backfill";

async function databaseClient() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !(await getPortalAccess(client)).database) throw new Error("Database access required.");
  return client;
}

/** Scan all missing places, including archived rows, independently of UI filters. */
export async function prepareMunicipalityBackfill() {
  const client = await databaseClient();
  const stops: MissingMunicipalityStop[] = [];
  let after: string | null = null;
  const deadline = Date.now() + 25_000;
  for (;;) {
    if (stops.length >= 100_000 || Date.now() >= deadline) throw new Error("The missing-municipality scan exceeded its limit. No changes were applied.");
    const { data, error } = await client.rpc("list_stops_missing_municipality", { p_after: after, p_limit: 250 });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MissingMunicipalityStop[];
    if (!rows.length) break;
    const next = rows.at(-1)!.id;
    if (after && next <= after) throw new Error("The municipality scan did not advance.");
    stops.push(...rows);
    after = next;
  }
  if (!stops.length) return { scanned: 0, candidates: [], issues: [] };
  const response = await fetch(EFA_STOP_LIST_URL, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`EFA returned HTTP ${response.status}. No changes were applied.`);
  const plan = planMunicipalityBackfill(stops, await limitedJson(response, 20 * 1024 * 1024));
  return { scanned: stops.length, ...plan };
}

export async function applyMunicipalityBackfillBatch(candidates: MunicipalityCandidate[]) {
  const client = await databaseClient();
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 250) throw new Error("Invalid municipality batch size.");
  const rows = candidates.map(row => {
    const reference = municipalityByOmc.get(row?.omc);
    if (!reference || typeof row.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id) || typeof row.sourceId !== "string" || !/^it:22021:[^\s(),]+$/.test(row.sourceId)) throw new Error("Invalid municipality candidate.");
    return { id: row.id, source_id: row.sourceId, municipality_de: reference.de, municipality_it: reference.it };
  });
  const { data, error } = await client.rpc("fill_missing_stop_municipalities", { p_rows: rows });
  if (error) throw new Error(error.message);
  if (!data || !Number.isInteger(data.updated) || data.updated < 0 || data.updated > rows.length || !Array.isArray(data.details) || data.updated + data.details.length !== rows.length) throw new Error("The database returned an invalid municipality result. Check the results before retrying.");
  revalidatePath("/database");
  return data as { updated: number; details: { id: string; sourceId?: string; reason: string }[] };
}
