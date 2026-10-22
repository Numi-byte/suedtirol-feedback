"use client";

import { municipalityName } from "../../../../shared/municipality";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { stopName, useStops } from "@/lib/stops";
import type { BusStop } from "@/lib/stops";
import { StopPointList } from "@/components/stop-point-list";
import { useStopPoints } from "@/lib/stop-points";

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

function StopPoints({ placeId }: { placeId: string }) {
  const { language, t } = useLanguage();
  const { points, status } = useStopPoints(placeId);
  return <StopPointList placeId={placeId} points={points} status={status} language={language} labels={t.map} showMapLinks />;
}

/** Matches on all three stop names plus the municipality, so a search works
 *  whichever language the stop is known by. */
function matches(stop: BusStop, query: string) {
  const haystack = [stop.name_de, stop.name_it, stop.name_en, stop.municipality_de, stop.municipality_it, stop.municipality].join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export default function StopsPage() {
  const { language, t } = useLanguage();
  const { stops, loading } = useStops();
  const [query, setQuery] = useState("");
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const found = trimmed ? stops.filter((stop) => matches(stop, trimmed)) : stops;
    return [...found].sort((a, b) => stopName(a, language).localeCompare(stopName(b, language)));
  }, [stops, query, language]);

  return (
    <main className="content-page">
      <div className="page-title"><h1>{t.stops.title}</h1></div>

      <section className="stops-section">

        <div className="stops-search">
          <label htmlFor="stop-search">{t.stops.searchLabel}</label>
          <div className="search-row">
            <div className="search-field">
              <SearchIcon />
              <input
                id="stop-search"
                type="search"
                value={query}
                placeholder={t.stops.placeholder}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {query ? (
              <button className="search-clear" type="button" onClick={() => setQuery("")}>{t.stops.clear}</button>
            ) : null}
          </div>
        </div>

        <p className="stops-count" aria-live="polite">
          {loading ? t.stops.loading : `${results.length} ${results.length === 1 ? t.stops.countOne : t.stops.countMany}`}
        </p>

        {!loading && stops.length === 0 ? <p className="stops-empty">{t.stops.noStops}</p> : null}

        {!loading && stops.length > 0 && results.length === 0 ? (
          <p className="stops-empty">{t.stops.empty}<br /><span>{t.stops.emptyHint}</span></p>
        ) : null}

        <ul className="stops-list">
          {results.map((stop) => (
            <li key={stop.id}>
              <article className="stop-card">
                <div>
                  <span className="stop-card-place">{municipalityName(stop, language)}</span>
                  <h2>{stopName(stop, language)}</h2>
                  {stop.is_accessible ? <div className="transport-tags"><span>{t.stops.accessible}</span></div> : null}
                </div>
                <div className="stop-card-actions">
                  <button type="button" className="stop-card-cta" aria-expanded={expandedPlaceId === stop.id}
                    aria-controls={`stop-points-${stop.id}`} onClick={() => setExpandedPlaceId(current => current === stop.id ? null : stop.id)}>
                    {t.map.selectPoints}
                  </button>
                  <Link className="stop-card-map" href={`/?stop=${encodeURIComponent(stop.id)}`}
                    aria-label={t.stops.onMap} title={t.stops.onMap}>
                    <Image src="/icons/map-pin.svg" width={24} height={24} alt="" aria-hidden="true" />
                  </Link>
                </div>
                <div id={`stop-points-${stop.id}`} className="stop-card-points" hidden={expandedPlaceId !== stop.id}>
                  {expandedPlaceId === stop.id ? <StopPoints placeId={stop.id} /> : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
