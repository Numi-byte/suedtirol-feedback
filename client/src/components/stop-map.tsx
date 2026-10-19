"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import busIcon from "@/components/Bus.png";
import { stopName as nameFor } from "@/lib/stops";
import type { BusStop } from "@/lib/stops";
import { useStopPoints } from "@/lib/stop-points";
import { createStopClusterIndex, stopClusterDiameter } from "@/lib/stop-clusters";
import { CommentsIcon } from "@/components/comments-icon";

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
  stopPoints: string;
  pointsLoading: string;
  pointsError: string;
  noPoints: string;
  deselect: string;
  expandSearch: string;
  collapseSearch: string;
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const renderStopsRef = useRef<(() => void) | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const fittedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("stop");
  const [query, setQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(true);
  const sheetGestureRef = useRef<{ startY: number; swiped: boolean } | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapReady, setMapReady] = useState(false);
  const pointsFittedRef = useRef<string | null>(null);
  const updateSelection = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) { url.searchParams.set("stop", id); setSearchExpanded(false); }
    else { url.searchParams.delete("stop"); setQuery(""); }
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router]);

  const stopName = (stop: BusStop) => nameFor(stop, language);
  const filteredStops = useMemo(() => {
    if (selectedId) return stops.filter(stop => stop.id === selectedId);
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return stops;
    return stops.filter((stop) => {
      const searchable = [stop.name_de, stop.name_it, stop.name_en, stop.municipality].join(" ").toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }, [query, stops, selectedId]);
  const clusterIndex = useMemo(() => createStopClusterIndex(filteredStops), [filteredStops]);
  const listedStops = useMemo(() => {
    if (selectedId || query.trim()) return filteredStops;
    return [...stops]
      .sort((a, b) => b.feedback_count - a.feedback_count || stopName(a).localeCompare(stopName(b)))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStops, language, query, stops, selectedId]);
  const selected = filteredStops.find((stop) => stop.id === selectedId) ?? null;
  const { points } = useStopPoints(selected?.id ?? null);

  // Keep the search and its results above the phone's software keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const searching = document.activeElement?.id === "map-stop-search";
        const inset = searching ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
        canvasRef.current?.style.setProperty("--map-keyboard-inset", `${inset}px`);
      });
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

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
      map.createPane("stopPoints").style.zIndex = "650";
      mapRef.current = map;
      map.on("click", event => {
        const target = event.originalEvent.target;
        if (target instanceof Element && target.closest(".leaflet-marker-icon, .stop-point-dot, .leaflet-control")) return;
        updateSelection(null);
      });
      setMapReady(true);
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
  }, [updateSelection]);

  // Build the spatial index only when stops/search change. Render just the
  // visible clusters and reuse existing markers while panning or selecting.
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();

      const stopsById = new Map(filteredStops.map(stop => [stop.id, stop]));
      const singleIcon = (selected: boolean) => L.divIcon({
        className: "stop-marker", html: markerImage(selected),
        iconSize: [44, 44], iconAnchor: [22, 22],
      });
      const normalIcon = singleIcon(false);
      const selectedIcon = singleIcon(true);
      const addStop = (stop: BusStop) => {
        const key = `stop:${stop.id}`;
        if (markersRef.current.has(key)) return;
        const name = nameFor(stop, language) || stop.name_it || stop.name_de;
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: stop.id === selectedIdRef.current ? selectedIcon : normalIcon,
          title: name,
          alt: `${name} – ${stop.municipality}`,
          keyboard: true,
        });
        const text = document.createElement("span");
        text.textContent = name;
        marker.bindTooltip(text, { direction: "top", offset: [0, -38] });
        marker.on("click", () => focusStop(stop));
        marker.addTo(map);
        markersRef.current.set(key, marker);
      };
      let previousSelected: string | null = null;
      const render = () => {
        if (cancelled) return;
        const bounds = map.getBounds().pad(0.15);
        const features = clusterIndex.getClusters([
          bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
        ], Math.floor(map.getZoom()));
        const visibleKeys = new Set<string>();
        for (const feature of features) {
          const props = feature.properties;
          if (!("cluster" in props)) {
            visibleKeys.add(`stop:${props.stop.id}`);
            addStop(props.stop);
            continue;
          }
          const key = `cluster:${props.cluster_id}`;
          visibleKeys.add(key);
          if (markersRef.current.has(key)) continue;
          const count = props.point_count;
          const diameter = stopClusterDiameter(count);
          const label = `${count.toLocaleString(language)} ${labels.stopsAvailable}`;
          const [longitude, latitude] = feature.geometry.coordinates;
          const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({ className: "stop-cluster", html: `<span>${count.toLocaleString(language)}</span>`,
              iconSize: [diameter, diameter], iconAnchor: [diameter / 2, diameter / 2] }),
            title: label, alt: label, keyboard: true,
          });
          marker.on("click", () => {
            const zoom = Math.min(map.getMaxZoom(), clusterIndex.getClusterExpansionZoom(props.cluster_id));
            map.stop().setView([latitude, longitude], zoom, { animate: false });
          });
          marker.addTo(map);
          marker.getElement()?.setAttribute("aria-label", label);
          markersRef.current.set(key, marker);
        }
        // Keep a selected place visible even if its neighbours remain clustered.
        const selectedStop = selectedIdRef.current ? stopsById.get(selectedIdRef.current) : undefined;
        if (selectedStop && bounds.contains([selectedStop.latitude, selectedStop.longitude])) {
          visibleKeys.add(`stop:${selectedStop.id}`);
          addStop(selectedStop);
        }
        for (const [key, marker] of markersRef.current) {
          if (!visibleKeys.has(key)) { marker.remove(); markersRef.current.delete(key); }
        }
        if (previousSelected !== selectedIdRef.current) {
          if (previousSelected) markersRef.current.get(`stop:${previousSelected}`)?.setIcon(normalIcon);
          if (selectedIdRef.current) markersRef.current.get(`stop:${selectedIdRef.current}`)?.setIcon(selectedIcon);
          previousSelected = selectedIdRef.current;
        }
      };
      let frame: number | undefined;
      const scheduleRender = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { frame = undefined; render(); });
      };
      map.on("moveend zoomend resize", scheduleRender);
      renderStopsRef.current = render;
      dispose = () => {
        map.off("moveend zoomend resize", scheduleRender);
        if (frame !== undefined) cancelAnimationFrame(frame);
        renderStopsRef.current = null;
        for (const marker of markersRef.current.values()) marker.remove();
        markersRef.current.clear();
      };

      // Frame the real stops the first time they arrive, then leave the view alone.
      if (!fittedRef.current && filteredStops.length > 0) {
        fittedRef.current = true;
        if (filteredStops.length === 1) {
          map.setView([filteredStops[0].latitude, filteredStops[0].longitude], 15);
        } else {
          // Pad around the floating panels so no marker hides behind them.
          const wide = map.getSize().x >= 760;
          map.fitBounds(L.latLngBounds(filteredStops.map((stop) => [stop.latitude, stop.longitude])), {
            paddingTopLeft: wide ? [410, 200] : [40, 180],
            paddingBottomRight: wide ? [300, 110] : [40, 240],
            maxZoom: 15,
          });
        }
      }
      render();
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterIndex, language, mapReady]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    renderStopsRef.current?.();
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (selected && mapReady && map) {
      map.stop().setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15), { animate: false });
    }
  }, [selected, mapReady]);

  // A separate layer is discarded as soon as the selection changes. Names are
  // DOM text, never HTML, because they originate in uploaded spreadsheets.
  useEffect(() => {
    let cancelled = false;
    let removeLayer: (() => void) | undefined;
    if (!selected || !points.length) pointsFittedRef.current = null;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (cancelled || !map || !selected || !points.length) return;
      const layer = L.layerGroup().addTo(map);
      removeLayer = () => layer.remove();
      for (const point of points) {
        const label = `${language === "it" ? point.name_it : point.name_de} · ${point.point_number}`;
        const text = document.createElement("span");
        text.textContent = label;
        const dot = L.circleMarker([point.latitude, point.longitude], {
          pane: "stopPoints", className: "stop-point-dot", radius: 7,
          color: "#fff", weight: 2, fillColor: "#007eb5", fillOpacity: 1,
        });
        dot.bindTooltip(text, { direction: "top", offset: [0, -8] }).addTo(layer);
        const element = dot.getElement();
        element?.setAttribute("role", "img");
        element?.setAttribute("aria-label", label);
        element?.setAttribute("tabindex", "0");
        element?.addEventListener("focus", () => dot.openTooltip());
        element?.addEventListener("blur", () => dot.closeTooltip());
      }
      if (pointsFittedRef.current !== selected.id) {
        pointsFittedRef.current = selected.id;
        const wide = map.getSize().x >= 760;
        map.stop().fitBounds(L.latLngBounds([
          [selected.latitude, selected.longitude],
          ...points.map((point): [number, number] => [point.latitude, point.longitude]),
        ]), {
          paddingTopLeft: wide ? [410, 80] : [30, 180],
          paddingBottomRight: wide ? [300, 110] : [30, 280], maxZoom: 17, animate: false,
        });
      }
    })();
    return () => { cancelled = true; removeLayer?.(); };
  }, [points, selected, language, mapReady]);

  const focusStop = (stop: BusStop) => {
    updateSelection(stop.id);
    const map = mapRef.current;
    map?.stop().setView([stop.latitude, stop.longitude], Math.max(map.getZoom(), 15), { animate: false });
  };

  return (
    <div ref={canvasRef} className={`map-canvas${selected ? " has-selected-stop" : ""}${searchExpanded ? " search-expanded" : " search-collapsed"}`}>
      <div className="map-surface" ref={containerRef} role="application" aria-label={labels.title} aria-busy={mapStatus === "loading"} />
      {mapStatus !== "ready" ? (
        <div className={`map-loading ${mapStatus === "error" ? "error" : ""}`} role="status" aria-live="polite">
          {mapStatus === "loading" ? <span className="loading-spinner" aria-hidden="true" /> : null}
          <p>{mapStatus === "error" ? labels.loadError : labels.loading}</p>
        </div>
      ) : null}

      <button type="button" className="map-search-back"
        aria-label={searchExpanded && !selected ? labels.collapseSearch : labels.expandSearch}
        aria-expanded={searchExpanded && !selected} aria-controls="map-search-sheet"
        onClick={() => {
          if (selected) { updateSelection(null); setSearchExpanded(true); }
          else { setSearchExpanded(expanded => !expanded); document.getElementById("map-stop-search")?.blur(); }
        }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 7-5 5 5 5" /></svg>
      </button>
      <section id="map-search-sheet" className="map-intro" aria-labelledby="map-heading">
        <button type="button" className="map-sheet-handle"
          aria-label={searchExpanded ? labels.collapseSearch : labels.expandSearch}
          aria-expanded={searchExpanded} aria-controls="map-search-content"
          onPointerDown={event => {
            sheetGestureRef.current = { startY: event.clientY, swiped: false };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={event => {
            const gesture = sheetGestureRef.current;
            if (!gesture || Math.abs(event.clientY - gesture.startY) < 32) return;
            gesture.swiped = true;
            setSearchExpanded(event.clientY < gesture.startY);
            document.getElementById("map-stop-search")?.blur();
          }}
          onPointerCancel={() => { sheetGestureRef.current = null; }}
          onClick={() => {
            if (!sheetGestureRef.current?.swiped) setSearchExpanded(expanded => !expanded);
            sheetGestureRef.current = null;
          }}><span aria-hidden="true" /></button>
        <button type="button" className="map-search-peek" aria-expanded={searchExpanded}
          aria-controls="map-search-content" onClick={() => setSearchExpanded(true)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m16 16 4.5 4.5" /></svg>
          {labels.title}
        </button>
        <div id="map-search-content" className="map-search-content">
          <h2 id="map-heading">{labels.title}</h2>
          <label className="map-search" htmlFor="map-stop-search">
            <span className="sr-only">{labels.searchLabel}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m16 16 4.5 4.5" />
            </svg>
            <input id="map-stop-search" type="search" value={query} placeholder={labels.searchPlaceholder} autoComplete="off" onFocus={() => setSearchExpanded(true)} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="map-search-results">
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
        </div>
      </section>

      <div className="map-panel" aria-live="polite">
        {selected ? (
          <>
            <span className="map-panel-label">{selected.municipality}</span>
            <div className="map-panel-heading">
              <h3>{stopName(selected)}</h3>
              <button type="button" className="map-deselect" aria-label={labels.deselect} title={labels.deselect}
                onClick={() => updateSelection(null)}>
                <Image src="/icons/close.svg" width={12} height={12} alt="" aria-hidden="true" />
              </button>
            </div>
            {selected.is_accessible ? <div className="transport-tags"><span>{labels.accessible}</span></div> : null}
            <div className="map-panel-actions">
              <a className="map-panel-feedback" href={`/feedback?stop=${encodeURIComponent(selected.id)}&lang=${language}&name=${encodeURIComponent(stopName(selected))}`}>
                {labels.feedback}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </a>
              <a className="map-panel-comments" href={`/feedback?stop=${encodeURIComponent(selected.id)}&lang=${language}&name=${encodeURIComponent(stopName(selected))}#feedback-threads`}
                aria-label={labels.comments} title={labels.comments}>
                <CommentsIcon />
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
