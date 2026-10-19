import Supercluster from "supercluster";
import type { BusStop } from "./stops";

export const STOP_CLUSTER_MAX_ZOOM = 17;

/** Index stop places only. Platform/stop-point dots never enter this index. */
export function createStopClusterIndex(stops: BusStop[]) {
  return new Supercluster<{ stop: BusStop }>({
    radius: 80, extent: 256, maxZoom: STOP_CLUSTER_MAX_ZOOM, minPoints: 2,
  }).load(stops.map(stop => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [stop.longitude, stop.latitude] },
    properties: { stop },
  })));
}

export function stopClusterDiameter(count: number) {
  return Math.round(Math.min(84, 32 + 4 * Math.log2(Math.max(2, count))));
}
