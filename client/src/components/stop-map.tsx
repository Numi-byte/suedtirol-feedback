"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import busIcon from "@/components/Bus.png";
import { stopName as nameFor } from "@/lib/stops";
import type { BusStop } from "@/lib/stops";

export type MapLabels = {
  eyebrow: string;
  title: string;
  stopsAvailable: string;
  choose: string;
  noStops: string;
  bus: string;
  accessible: string;
  feedback: string;
  comments: string;
  attribution: string;
  loading: string;
  loadError: string;
  searchLabel: string;
  searchPlaceholder: string;
  noResults: string;
  popularStops: string;
};

/** South Tyrol, used until the published stops define their own extent. */
const REGION_CENTER: [number, number] = [46.6, 11.4];
const REGION_ZOOM = 9;

/** Use the supplied transport artwork consistently for every map marker. */
function markerImage(selected: boolean) {
  return `<img src="${busIcon.src}" alt="" aria-hidden="true" class="${selected ? "is-selected" : ""}" />`;
}

type StopMapProps = { stops: BusStop[]; language: "de" | "it" | "en"; labels: MapLabels };

export function StopMap({ stops, language, labels }: StopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const fittedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  const stopName = (stop: BusStop) => nameFor(stop, language);
  const filteredStops = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return stops;
    return stops.filter((stop) => {
      const searchable = [stop.name_de, stop.name_it, stop.name_en, stop.municipality].join(" ").toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }, [query, stops]);
  const listedStops = useMemo(() => {
    if (query.trim()) return filteredStops;
    return [...stops]
      .sort((a, b) => b.feedback_count - a.feedback_count || stopName(a).localeCompare(stopName(b)))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStops, language, query, stops]);
  const selected = filteredStops.find((stop) => stop.id === selectedId) ?? null;

  // Create the map once. Leaflet needs the DOM, so it is imported client-side only.
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;

    const initialiseMap = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: REGION_CENTER,
        zoom: REGION_ZOOM,
        zoomControl: false,
        scrollWheelZoom: true,
      });
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: labels.attribution,
        updateWhenIdle: true,
        keepBuffer: 1,
      });
      tiles.once("load", () => {
        if (!cancelled) setMapStatus("ready");
      });
      tiles.addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.attributionControl.setPrefix(false);
      mapRef.current = map;
    };
    const start = () => initialiseMap().catch(() => {
      if (!cancelled) setMapStatus("error");
    });
    const scheduler: {
      requestIdleCallback?: Window["requestIdleCallback"];
      cancelIdleCallback?: Window["cancelIdleCallback"];
    } = window;
    const idleId: number = scheduler.requestIdleCallback
      ? scheduler.requestIdleCallback(start, { timeout: 1200 })
      : globalThis.setTimeout(start, 1) as unknown as number;

    return () => {
      cancelled = true;
      if (scheduler.cancelIdleCallback) scheduler.cancelIdleCallback(idleId);
      else globalThis.clearTimeout(idleId);
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      fittedRef.current = false;
    };
    // labels.attribution is static copy; the map is intentionally built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the markers whenever the published stops or the language change.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();

      for (const stop of filteredStops) {
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: L.divIcon({
            className: "stop-marker",
            html: markerImage(stop.id === selectedId),
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          title: stopName(stop),
          alt: `${stopName(stop)} – ${stop.municipality}`,
          keyboard: true,
        });
        marker.bindTooltip(stopName(stop), { direction: "top", offset: [0, -38] });
        marker.on("click", () => setSelectedId(stop.id));
        marker.on("keypress", () => setSelectedId(stop.id));
        marker.addTo(map);
        markersRef.current.set(stop.id, marker);
      }

      // Frame the real stops the first time they arrive, then leave the view alone.
      if (!fittedRef.current && stops.length > 0) {
        fittedRef.current = true;
        if (stops.length === 1) {
          map.setView([stops[0].latitude, stops[0].longitude], 15);
        } else {
          // Pad around the floating panels so no marker hides behind them.
          const wide = map.getSize().x >= 760;
          map.fitBounds(L.latLngBounds(stops.map((stop) => [stop.latitude, stop.longitude])), {
            paddingTopLeft: wide ? [410, 200] : [40, 180],
            paddingBottomRight: wide ? [300, 110] : [40, 240],
            maxZoom: 15,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStops, language, selectedId, mapStatus]);

  const focusStop = (stop: BusStop) => {
    setSelectedId(stop.id);
    mapRef.current?.flyTo([stop.latitude, stop.longitude], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
  };

  return (
    <div className="map-canvas">
      <div className="map-surface" ref={containerRef} role="application" aria-label={labels.title} aria-busy={mapStatus === "loading"} />
      {mapStatus !== "ready" ? (
        <div className={`map-loading ${mapStatus === "error" ? "error" : ""}`} role="status" aria-live="polite">
          {mapStatus === "loading" ? <span className="loading-spinner" aria-hidden="true" /> : null}
          <p>{mapStatus === "error" ? labels.loadError : labels.loading}</p>
        </div>
      ) : null}

      <div className="map-intro">
        <h2 id="map-heading">{labels.title}</h2>
        <label className="map-search" htmlFor="map-stop-search">
          <span className="sr-only">{labels.searchLabel}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m16 16 4.5 4.5" />
          </svg>
          <input id="map-stop-search" type="search" value={query} placeholder={labels.searchPlaceholder} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="map-quick-heading">
          {query.trim() ? `${filteredStops.length} ${labels.stopsAvailable}` : labels.popularStops}
        </div>
        {listedStops.length > 0 ? (
          <ul className="map-stop-list">
            {listedStops.map((stop) => (
              <li key={stop.id}>
                <button type="button" aria-current={stop.id === selectedId} onClick={() => focusStop(stop)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={busIcon.src} alt="" aria-hidden="true" />
                  <span><strong>{stopName(stop)}</strong><small>{stop.municipality}</small></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="map-search-empty">{labels.noResults}</p>}
      </div>

      <div className="map-panel" aria-live="polite">
        {selected ? (
          <>
            <span className="map-panel-label">{selected.municipality}</span>
            <h3>{stopName(selected)}</h3>
            <p>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</p>
            <div className="transport-tags">
              <span>{labels.bus}</span>
              {selected.is_accessible ? <span>{labels.accessible}</span> : null}
            </div>
            <div className="map-panel-actions">
              <a className="map-panel-feedback" href={`/feedback?stop=${encodeURIComponent(selected.id)}&lang=${language}&name=${encodeURIComponent(stopName(selected))}`}>
                {labels.feedback}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </a>
              <a className="map-panel-comments" href={`/feedback?stop=${encodeURIComponent(selected.id)}&lang=${language}&name=${encodeURIComponent(stopName(selected))}#feedback-threads`}>
                {labels.comments}
              </a>
            </div>
          </>
        ) : (
          <p className="map-panel-empty">{stops.length === 0 ? labels.noStops : filteredStops.length === 0 ? labels.noResults : labels.choose}</p>
        )}
      </div>

    </div>
  );
}
