"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

export type BusStop = {
  id: string;
  name_de: string;
  name_it: string;
  name_en: string;
  municipality: string;
  latitude: number;
  longitude: number;
  is_accessible: boolean;
};

export function stopName(stop: BusStop, language: Language) {
  return stop[`name_${language}` as "name_de" | "name_it" | "name_en"];
}

/** Published stops, as saved in the protected portal. */
export function useStops() {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stops")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: BusStop[]) => { if (!cancelled) setStops(data); })
      .catch(() => { if (!cancelled) setStops([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { stops, loading };
}
