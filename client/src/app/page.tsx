"use client";

import { Suspense, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { StopMap } from "@/components/stop-map";
import { useStops } from "@/lib/stops";

/** Home is the map: header above, map filling the viewport, footer pinned below. */
export default function HomePage() {
  const { language, t } = useLanguage();
  const { stops, loading, error, retry } = useStops();
  const [attempt, setAttempt] = useState(0);

  return (
    <main className="map-section" aria-labelledby="map-heading">
      <Suspense fallback={<div className="map-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><p>{t.map.loading}</p></div>}>
        <StopMap key={attempt} stops={stops} stopsLoading={loading} stopsError={error} onRetry={() => { retry(); setAttempt(value => value + 1); }} retryLabel={t.stops.retry} language={language} labels={t.map} />
      </Suspense>
    </main>
  );
}
