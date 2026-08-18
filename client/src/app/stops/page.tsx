"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { stopName, useStops } from "@/lib/stops";
import type { BusStop } from "@/lib/stops";

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

/** Matches on all three stop names plus the municipality, so a search works
 *  whichever language the stop is known by. */
function matches(stop: BusStop, query: string) {
  const haystack = [stop.name_de, stop.name_it, stop.name_en, stop.municipality].join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export default function StopsPage() {
  const { language, t } = useLanguage();
  const { stops, loading } = useStops();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const found = trimmed ? stops.filter((stop) => matches(stop, trimmed)) : stops;
    return [...found].sort((a, b) => stopName(a, language).localeCompare(stopName(b, language)));
  }, [stops, query, language]);

  return (
    <main className="content-page">
      <div className="page-title"><h1>{t.stops.title}</h1></div>

      <section className="stops-section">
        <span className="mini-label">{t.stops.eyebrow}</span>

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
                  <span className="stop-card-place">{stop.municipality}</span>
                  <h2>{stopName(stop, language)}</h2>
                  <div className="transport-tags">
                    <span>{t.stops.bus}</span>
                    {stop.is_accessible ? <span>{t.stops.accessible}</span> : null}
                  </div>
                </div>
                <div className="stop-card-actions">
                  <Link
                    className="stop-card-cta"
                    href={`/feedback?stop=${encodeURIComponent(stop.id)}&lang=${language}&name=${encodeURIComponent(stopName(stop, language))}`}
                  >
                    {t.stops.feedback} <ArrowIcon />
                  </Link>
                  <Link className="stop-card-map" href="/">{t.stops.onMap}</Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
