"use client";

import { useLanguage } from "@/components/language-provider";
import { StopMap } from "@/components/stop-map";
import { useStops } from "@/lib/stops";

/** Home is the map: header above, map filling the viewport, footer pinned below. */
export default function HomePage() {
  const { language, t } = useLanguage();
  const { stops } = useStops();

  return (
    <main className="map-section" aria-labelledby="map-heading">
      <StopMap stops={stops} language={language} labels={t.map} />
    </main>
  );
}
