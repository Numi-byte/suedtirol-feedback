"use client";

import { municipalityName } from "../../../../shared/municipality";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { stopName, useStops } from "@/lib/stops";
import type { BusStop } from "@/lib/stops";
import { StopPointList } from "@/components/stop-point-list";
import { useStopPoints } from "@/lib/stop-points";

const PAGE_SIZE = 12;

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="7" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

function StopPoints({ placeId }: { placeId: string }) {
  const { language, t } = useLanguage();
  const { points, status } = useStopPoints(placeId);
  return <StopPointList placeId={placeId} points={points} status={status} language={language} labels={t.map} showMapLinks />;
}

/** Search every name and both municipality translations, regardless of UI language. */
function matches(stop: BusStop, query: string) {
  const haystack = [stop.name_de, stop.name_it, stop.name_en, stop.municipality_de, stop.municipality_it, stop.municipality].join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export default function StopsPage() {
  const { language, t } = useLanguage();
  const { stops, loading, error, retry } = useStops();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const sortedStops = useMemo(() => [...stops].sort((a, b) => stopName(a, language).localeCompare(stopName(b, language))), [stops, language]);
  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return trimmed ? sortedStops.filter(stop => matches(stop, trimmed)) : sortedStops;
  }, [sortedStops, query]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleStops = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
    setExpandedPlaceId(null);
  }

  function clearSearch() {
    changeQuery("");
    searchRef.current?.focus();
  }

  function changePage(next: number) {
    setPage(next);
    setExpandedPlaceId(null);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <main className="content-page info-page stops-page">
      <div className="page-title"><h1>{t.nav.find}</h1></div>

      <section className="stops-search" aria-labelledby="stop-search-label">
        <label id="stop-search-label" htmlFor="stop-search">{t.stops.searchLabel}</label>
        <div className="search-row">
          <div className="search-field">
            <SearchIcon />
            <input ref={searchRef} id="stop-search" type="search" value={query}
              placeholder={t.stops.placeholder} autoComplete="off" aria-controls="stop-results"
              onChange={event => changeQuery(event.target.value)} />
            {query ? <button className="search-clear" type="button" onClick={clearSearch}
              aria-label={t.stops.clear} title={t.stops.clear}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 7 10 10M17 7 7 17" /></svg>
            </button> : null}
          </div>
        </div>
      </section>

      <section ref={resultsRef} id="stop-results" className="stops-section" tabIndex={-1}
        aria-labelledby="stops-results-heading" aria-busy={loading}>
        <div className="stops-results-heading">
          <h2 id="stops-results-heading" className="stops-count" aria-live="polite">
            {loading ? t.stops.loading : error ? t.stops.loadError : `${results.length} ${results.length === 1 ? t.stops.countOne : t.stops.countMany}`}
          </h2>
          {!loading && !error && results.length > 0 ? <span className="stops-range">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, results.length)} / {results.length}
          </span> : null}
        </div>

        {loading ? <div className="stops-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div className="stop-card stop-card-skeleton" key={index}>
            <span /><span /><span />
          </div>)}
        </div> : error ? <div className="stops-state">
          <SearchIcon /><p>{t.stops.loadError}</p><button type="button" onClick={retry}>{t.stops.retry}</button>
        </div> : results.length === 0 ? <div className="stops-state">
          <SearchIcon /><h3>{stops.length ? t.stops.empty : t.stops.noStops}</h3>
          {stops.length ? <><p>{t.stops.emptyHint}</p><button type="button" onClick={clearSearch}>{t.stops.clear}</button></> : null}
        </div> : <ul className="stops-list">
          {visibleStops.map(stop => (
            <li key={stop.id}>
              <article className={`stop-card${expandedPlaceId === stop.id ? " is-expanded" : ""}`}>
                <div className="stop-card-heading">
                  <span className="stop-card-place">{municipalityName(stop, language)}</span>
                  <h3>{stopName(stop, language)}</h3>
                  {stop.is_accessible ? <div className="transport-tags"><span>{t.stops.accessible}</span></div> : null}
                </div>
                <div className="stop-card-actions">
                  <button type="button" className="stop-card-cta" aria-expanded={expandedPlaceId === stop.id}
                    aria-label={`${expandedPlaceId === stop.id ? t.stops.hidePoints : t.map.selectPoints} · ${stopName(stop, language)}`}
                    aria-controls={`stop-points-${stop.id}`} onClick={() => setExpandedPlaceId(current => current === stop.id ? null : stop.id)}>
                    <span>{expandedPlaceId === stop.id ? t.stops.hidePoints : t.map.selectPoints}</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 10 5 5 5-5" /></svg>
                  </button>
                  <Link className="stop-card-map" href={`/?stop=${encodeURIComponent(stop.id)}`}
                    aria-label={`${t.stops.onMap} · ${stopName(stop, language)}`} title={t.stops.onMap}>
                    <Image src="/icons/map-pin.svg" width={24} height={24} alt="" aria-hidden="true" />
                  </Link>
                </div>
                <div id={`stop-points-${stop.id}`} className="stop-card-points" hidden={expandedPlaceId !== stop.id}>
                  {expandedPlaceId === stop.id ? <StopPoints placeId={stop.id} /> : null}
                </div>
              </article>
            </li>
          ))}
        </ul>}

        {!loading && !error && pageCount > 1 ? <nav className="stops-pagination" aria-label={t.stops.paginationLabel}>
          <button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m14 7-5 5 5 5" /></svg>
            {t.stops.previous}
          </button>
          <span role="status">{t.stops.page} {currentPage} {t.stops.of} {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>
            {t.stops.next}
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m10 7 5 5-5 5" /></svg>
          </button>
        </nav> : null}
      </section>
    </main>
  );
}
