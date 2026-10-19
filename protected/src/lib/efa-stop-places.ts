export const EFA_STOP_LIST_URL = "https://efa.sta.bz.it/apb/XML_STOPLIST_REQUEST?coordOutputFormat=EPSG:4326&hideBannerInfo=1&lineListSubnetwork=apb&outputFormat=rapidJSON";

export type EfaStopPlace = {
  id_version: string;
  stop_id: string | null;
  name_it: string;
  latitude: number;
  longitude: number;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

export function readEfaStopPlaces(payload: unknown) {
  const locations = record(payload)?.locations;
  if (!Array.isArray(locations)) throw new Error("The EFA response does not contain a locations array.");
  const rows = new Map<string, EfaStopPlace>();
  const errors: string[] = [];
  const rejected = new Set<string>();
  let excluded = 0;
  let duplicates = 0;
  let matching = 0;
  for (const value of locations) {
    const stop = record(value);
    if (!stop || typeof stop.id !== "string" || !stop.id.startsWith("it:22021:")) {
      excluded++;
      continue;
    }
    matching++;
    const stopId = record(stop.properties)?.stopId;
    const coord = stop.coord;
    if (!/^it:22021:[^\s(),]+$/.test(stop.id) || typeof stop.name !== "string" || !stop.name.trim() ||
      !Array.isArray(coord) || coord.length < 2 ||
      typeof coord[0] !== "number" || !Number.isFinite(coord[0]) || Math.abs(coord[0]) > 90 ||
      typeof coord[1] !== "number" || !Number.isFinite(coord[1]) || Math.abs(coord[1]) > 180) {
      errors.push(`${stop.id}: missing name or valid [latitude, longitude] coordinates, or malformed ID.`);
      continue;
    }
    const row: EfaStopPlace = { id_version: `(it:apb:StopPlace:${stop.id},any)`,
      stop_id: typeof stopId === "string" ? stopId.trim() || null :
        typeof stopId === "number" && Number.isSafeInteger(stopId) ? String(stopId) : null,
      name_it: stop.name.trim(), latitude: coord[0], longitude: coord[1] };
    const previous = rows.get(row.id_version);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(row)) {
        errors.push(`${stop.id}: conflicting EFA records; this ID was not imported.`);
        rejected.add(row.id_version);
      }
      duplicates++;
    } else rows.set(row.id_version, row);
  }
  // Deduplicate by the full place ID. stopId is additional metadata; it is
  // not a reason to omit a different complete source identifier.
  return { rows: [...rows.values()].filter(row => !rejected.has(row.id_version)), errors, excluded, duplicates,
    received: locations.length, matching };
}
