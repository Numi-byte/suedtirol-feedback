"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStopPoints } from "@/lib/stop-points";
import { stopPointName } from "@/lib/stop-point-links";
import { translations, type Language } from "@/lib/i18n";

const copy = {
  de: { title: "Haltepunkt auf der Karte", hint: "Wähle den Haltepunkt, den du bewerten möchtest. Die Karte lässt sich nicht verschieben oder zoomen.", changing: "Haltepunkt wird geladen …" },
  it: { title: "Punto di fermata sulla mappa", hint: "Scegli il punto di fermata che vuoi valutare. La mappa non si può spostare o ingrandire.", changing: "Caricamento del punto di fermata …" },
  en: { title: "Stop point on the map", hint: "Choose the stop point you want to rate. The map cannot be dragged or zoomed.", changing: "Loading stop point …" },
};

export function FeedbackPointMap({ placeId, selectedId, language, disabled, onSelect }: {
  placeId: string; selectedId: string; language: Language;
  disabled: boolean; onSelect: (id: string) => void;
}) {
  const { points, status } = useStopPoints(placeId);
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const activeId = useRef(selectedId);
  activeId.current = selectedId;
  const select = useRef(onSelect);
  const locked = useRef(disabled);
  select.current = onSelect;
  locked.current = disabled;
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const labels = translations[language].map;
  const text = copy[language];

  useEffect(() => {
    if (status !== "ready" || !canvas.current || !points.length) return;
    const pointMarkers = markers.current;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let instance: LeafletMap | undefined;
    setMapStatus("loading");
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !canvas.current) return;
      instance = L.map(canvas.current, { zoomControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomAnimation: false,
        fadeAnimation: false, attributionControl: true });
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);
      for (const point of points) {
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
        const pos: [number, number] = [point.latitude, point.longitude];
        const button = document.createElement("button"); button.type = "button";
        button.className = "feedback-point-marker";
        button.setAttribute("aria-pressed", String(point.id === activeId.current));
        button.disabled = locked.current;
        button.setAttribute("aria-label", `${stopPointName(point, language)} · ${labels.pointLabel} ${point.point_number}`);
        button.title = button.getAttribute("aria-label")!;
        const dot = document.createElement("span"); dot.setAttribute("aria-hidden", "true"); button.append(dot);
        button.addEventListener("click", () => { if (!locked.current) select.current(point.id); });
        const marker = L.marker(pos, { keyboard: false, zIndexOffset: point.id === activeId.current ? 1000 : 0, icon: L.divIcon({ html: button,
          className: "feedback-marker-container", iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(instance);
        pointMarkers.set(point.id, marker);
      }
      const fit = () => {
        const target = pointMarkers.get(activeId.current) ?? pointMarkers.values().next().value;
        if (!instance || !target) return;
        instance.invalidateSize();
        instance.setView(target.getLatLng(), 19, { animate: false });
      };
      fit(); observer = new ResizeObserver(fit); observer.observe(canvas.current);
      setMapStatus("ready");
    })().catch(() => { if (!cancelled) setMapStatus("error"); });
    return () => { cancelled = true; observer?.disconnect(); instance?.remove(); map.current = null; pointMarkers.clear(); };
  }, [points, status, language, labels.pointLabel]);

  useEffect(() => {
    const target = markers.current.get(selectedId);
    if (target) map.current?.setView(target.getLatLng(), 19, { animate: false });
    for (const [id, marker] of markers.current) {
      const button = marker.getElement()?.querySelector<HTMLButtonElement>("button");
      button?.setAttribute("aria-pressed", String(id === selectedId));
      if (button) button.disabled = disabled;
      marker.setZIndexOffset(id === selectedId ? 1000 : 0);
    }
  }, [selectedId, disabled, mapStatus]);

  return <section className="feedback-location" aria-label={text.title} aria-busy={disabled}>
    <p className="feedback-location-hint">{text.hint}</p>
    <div className="feedback-location-frame">
      <div ref={canvas} className="feedback-location-canvas" aria-label={text.title} />
      {status !== "ready" || mapStatus !== "ready" ? <p className="feedback-location-status" role="status">{status === "error" || mapStatus === "error" ? labels.loadError : status === "ready" && !points.length ? labels.noPoints : labels.loading}</p> : null}
    </div>
    <div className="feedback-location-points" aria-label={labels.stopPoints}>
      {points.map(point => <button key={point.id} type="button" disabled={disabled} aria-pressed={point.id === selectedId}
        aria-label={`${stopPointName(point, language)} · ${labels.pointLabel} ${point.point_number}`}
        title={`${stopPointName(point, language)} · ${labels.pointLabel} ${point.point_number}`}
        onClick={() => onSelect(point.id)}>{point.point_number}</button>)}
    </div>
    {disabled ? <p className="feedback-location-hint" role="status">{text.changing}</p> : null}
  </section>;
}
