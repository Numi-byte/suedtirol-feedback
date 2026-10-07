"use client";

import { useEffect, useState } from "react";

export type StopPoint = { id: string; point_number: string; latitude: number; longitude: number; name_de: string; name_it: string };
type PointState = { placeId: string | null; points: StopPoint[]; status: "loading" | "ready" | "error" };

/** Abort stale selections, and never render one place's points under another. */
export function useStopPoints(placeId: string | null) {
  const [state, setState] = useState<PointState>({ placeId: null, points: [], status: "ready" });
  useEffect(() => {
    if (!placeId) return;
    const controller = new AbortController();
    fetch(`/api/stops/${encodeURIComponent(placeId)}/points`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Stop points could not be loaded.");
        const points: StopPoint[] = await response.json();
        if (!controller.signal.aborted) setState({ placeId, points, status: "ready" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ placeId, points: [], status: "error" });
      });
    return () => controller.abort();
  }, [placeId]);
  if (!placeId) return { points: [] as StopPoint[], status: "ready" as const };
  if (state.placeId !== placeId) return { points: [] as StopPoint[], status: "loading" as const };
  return state;
}
