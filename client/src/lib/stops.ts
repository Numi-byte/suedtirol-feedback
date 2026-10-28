"use client";

import { useCallback, useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

export type BusStop = {
  id: string;
  name_de: string;
  name_it: string;
  name_en: string;
  municipality: string;
  municipality_de?: string;
  municipality_it?: string;
  latitude: number;
  longitude: number;
  is_accessible: boolean;
  feedback_count: number;
};

export function stopName(stop: BusStop, language: Language) {
  return stop[`name_${language}`]?.trim() || stop.name_it?.trim() || stop.name_de?.trim() || stop.name_en?.trim() || "";
}

/** Published stops, as saved in the protected portal. */
export function useStops() {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/stops", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load stops");
        const data: BusStop[] = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid stop response");
        if (!controller.signal.aborted) setStops(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) { setStops([]); setError(true); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return { stops, loading, error, retry };
}
