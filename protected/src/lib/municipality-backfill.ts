import { municipalityByOmc } from "./municipality-reference.ts";

export type MissingMunicipalityStop = { id: string; id_version: string | null; name_it: string; municipality_de: string; municipality_it: string };
export type MunicipalityCandidate = { id: string; sourceId: string; omc: string };
export type MunicipalityIssue = { id: string; sourceId?: string; stopName?: string; reason: string };
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
export function efaPlaceSourceId(idVersion: string | null): string | undefined {
  return idVersion?.match(/^\(it:apb:StopPlace:(it:22021:[^\s(),]+),[^()]+\)$/)?.[1];
}

/** Municipality codes identify the comune even when parent.name is a frazione. */
export function readEfaMunicipalityMatches(payload: unknown) {
  const locations = record(payload)?.locations;
  if (!Array.isArray(locations)) throw new Error("The EFA response does not contain a locations array.");
  const matches = new Map<string, { omc: string; parentName: string }>();
  const rejected = new Set<string>();
  for (const value of locations) {
    const stop = record(value);
    if (typeof stop?.id !== "string" || !/^it:22021:[^\s(),]+$/.test(stop.id)) continue;
    const parent = record(stop.parent);
    const omc = record(parent?.properties)?.omc;
    const name = parent?.name;
    if (parent?.type !== "locality" || typeof omc !== "string" || !municipalityByOmc.has(omc) || typeof name !== "string" || !name.trim()) {
      rejected.add(stop.id); continue;
    }
    const previous = matches.get(stop.id);
    if (previous && previous.omc !== omc) rejected.add(stop.id);
    else matches.set(stop.id, { omc, parentName: name.trim() });
  }
  for (const id of rejected) matches.delete(id);
  return { matches, rejected };
}
export function planMunicipalityBackfill(stops: MissingMunicipalityStop[], payload: unknown) {
  const { matches, rejected } = readEfaMunicipalityMatches(payload);
  const candidates: MunicipalityCandidate[] = [];
  const issues: MunicipalityIssue[] = [];
  for (const stop of stops) {
    if (stop.municipality_de.trim() && stop.municipality_it.trim()) continue;
    const sourceId = efaPlaceSourceId(stop.id_version);
    const match = sourceId && matches.get(sourceId);
    if (!sourceId || !match) {
      issues.push({ id: stop.id, sourceId, stopName: stop.name_it, reason: !sourceId ? "no_complete_efa_place_id" : rejected.has(sourceId) ? "unknown_or_conflicting_municipality" : "stop_not_found_in_efa" });
      continue;
    }
    const names = municipalityByOmc.get(match.omc)!;
    if ((stop.municipality_de.trim() && stop.municipality_de.trim() !== names.de) || (stop.municipality_it.trim() && stop.municipality_it.trim() !== names.it)) {
      issues.push({ id: stop.id, sourceId, stopName: stop.name_it, reason: "existing_translation_conflicts_with_reference" });
      continue;
    }
    candidates.push({ id: stop.id, sourceId, omc: match.omc });
  }
  return { candidates, issues };
}
