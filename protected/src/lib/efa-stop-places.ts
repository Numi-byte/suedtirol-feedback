export const EFA_STOP_LIST_URL = "https://efa.sta.bz.it/apb/XML_STOPLIST_REQUEST?coordOutputFormat=EPSG:4326&hideBannerInfo=1&lineListSubnetwork=apb&outputFormat=rapidJSON";

export type EfaStopPlace = {
  id_version: string;
  stop_id: string;
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
  let excluded = 0;
  let duplicates = 0;
  for (const value of locations) {
    const stop = record(value);
    if (!stop || typeof stop.id !== "string" || !/^it:22021:[0-9]+$/.test(stop.id) || stop.type !== "stop") {
      excluded++;
      continue;
    }
    const stopId = record(stop.properties)?.stopId;
    const coord = stop.coord;
    if (typeof stop.name !== "string" || !stop.name.trim() || typeof stopId !== "string" || !stopId.trim() ||
      !Array.isArray(coord) || coord.length !== 2 ||
      typeof coord[0] !== "number" || !Number.isFinite(coord[0]) || Math.abs(coord[0]) > 90 ||
      typeof coord[1] !== "number" || !Number.isFinite(coord[1]) || Math.abs(coord[1]) > 180) {
      errors.push(`${stop.id}: missing name, stopId or valid [latitude, longitude] coordinates.`);
      continue;
    }
    const row = { id_version: `(it:apb:StopPlace:${stop.id},any)`, stop_id: stopId.trim(),
      name_it: stop.name.trim(), latitude: coord[0], longitude: coord[1] };
    const previous = rows.get(row.id_version);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(row)) throw new Error(`Conflicting EFA records for ${stop.id}. No import was started.`);
      duplicates++;
    } else rows.set(row.id_version, row);
  }
  // A stopId must not identify multiple places, even across database batches.
  const ids = new Set<string>();
  for (const row of rows.values()) {
    if (ids.has(row.stop_id)) throw new Error(`EFA stopId ${row.stop_id} identifies multiple places. No import was started.`);
    ids.add(row.stop_id);
  }
  return { rows: [...rows.values()], errors, excluded, duplicates };
}
