"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
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
  attribution: string;
};

/** South Tyrol, used until the published stops define their own extent. */
const REGION_CENTER: [number, number] = [46.6, 11.4];
const REGION_ZOOM = 9;

/** Bus-stop pin: white bus glyph on a südtirolmobil-blue teardrop. */
function markerSvg(selected: boolean) {
  const body = selected ? "#003f6d" : "#0069b4";
  return `
    <svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true">
      <path d="M16 1a15 15 0 0 0-15 15c0 10.5 15 25 15 25s15-14.5 15-25A15 15 0 0 0 16 1Z"
            fill="${body}" stroke="#fff" stroke-width="2.4" />
      <g transform="translate(7.5 6.5) scale(0.72)">
        <path fill="#fff" d="M6 2h12a3 3 0 0 1 3 3v11a2.5 2.5 0 0 1-1.5 2.3V19a1.75 1.75 0 0 1-3.5 0v-1h-8v1a1.75 1.75 0 0 1-3.5 0v-.7A2.5 2.5 0 0 1 3 16V5a3 3 0 0 1 3-3Z" />
        <rect x="5.2" y="4.6" width="13.6" height="5.6" rx="1.1" fill="${body}" />
        <circle cx="7.2" cy="14" r="1.45" fill="${body}" />
        <circle cx="16.8" cy="14" r="1.45" fill="${body}" />
      </g>
    </svg>`;
}

type StopMapProps = { stops: BusStop[]; language: "de" | "it" | "en"; labels: MapLabels };

export function StopMap({ stops, language, labels }: StopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const fittedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stopName = (stop: BusStop) => nameFor(stop, language);
  const selected = stops.find((stop) => stop.id === selectedId) ?? null;

  // Create the map once. Leaflet needs the DOM, so it is imported client-side only.
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: REGION_CENTER,
        zoom: REGION_ZOOM,
        zoomControl: false,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: labels.attribution,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.attributionControl.setPrefix(false);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
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

      for (const stop of stops) {
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: L.divIcon({
            className: "stop-marker",
            html: markerSvg(stop.id === selectedId),
            iconSize: [32, 42],
            iconAnchor: [16, 42],
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
  }, [stops, language, selectedId]);

  const focusStop = (stop: BusStop) => {
    setSelectedId(stop.id);
    mapRef.current?.flyTo([stop.latitude, stop.longitude], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
  };

  return (
    <div className="map-canvas">
      <div className="map-surface" ref={containerRef} role="application" aria-label={labels.title} />

      <div className="map-intro">
        <span className="mini-label">{labels.eyebrow}</span>
        <h2 id="map-heading">{labels.title}</h2>
        <p>{stops.length} {labels.stopsAvailable}</p>
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
            <a href={`/feedback?stop=${encodeURIComponent(selected.id)}&lang=${language}&name=${encodeURIComponent(stopName(selected))}`}>
              {labels.feedback}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14m-5-5 5 5-5 5" />
              </svg>
            </a>
          </>
        ) : (
          <p className="map-panel-empty">{stops.length > 0 ? labels.choose : labels.noStops}</p>
        )}
      </div>

      {stops.length > 0 ? (
        <ul className="map-stop-list">
          {stops.map((stop) => (
            <li key={stop.id}>
              <button type="button" aria-current={stop.id === selectedId} onClick={() => focusStop(stop)}>
                <strong>{stopName(stop)}</strong>
                <small>{stop.municipality}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
