"use client";

import Link from "next/link";
import Image from "next/image";
import outlineLocation from "@/components/OutlineLocation.svg";
import { CommentsIcon } from "@/components/comments-icon";
import { TransportIcon } from "@/components/transport-icon";
import type { Language } from "@/lib/i18n";
import type { StopPoint } from "@/lib/stop-points";
import { pointFeedbackHref, stopPointName } from "@/lib/stop-point-links";
import type { MapLabels } from "@/components/stop-map";

type Props = {
  points: StopPoint[];
  status: "loading" | "ready" | "error";
  language: Language;
  labels: MapLabels;
  placeId: string;
  selectedPointId?: string | null;
  onSelect?: (point: StopPoint) => void;
  onHighlight?: (id: string | null) => void;
  showMapLinks?: boolean;
};

export function StopPointList({ points, status, language, labels, placeId, selectedPointId, onSelect, onHighlight, showMapLinks }: Props) {
  if (status !== "ready") return <p className="point-list-status" role="status">{status === "loading" ? labels.pointsLoading : labels.pointsError}</p>;
  if (!points.length) return <p className="point-list-status">{labels.noPoints}</p>;
  return <ul className="stop-point-list">
    {points.map(point => <li key={point.id} className={point.id === selectedPointId ? "is-selected" : undefined}
      onMouseEnter={() => onHighlight?.(point.id)} onMouseLeave={() => onHighlight?.(null)}
      onFocus={() => onHighlight?.(point.id)} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight?.(null);
      }}>
      <div className="stop-point-name">
        <TransportIcon type={point.transport_type} language={language} />
        {onSelect ? <button type="button" aria-pressed={point.id === selectedPointId} onClick={() => onSelect(point)}>
          <strong>{stopPointName(point, language)}</strong><span>{labels.pointLabel} {point.point_number}</span>
        </button> : <div><strong>{stopPointName(point, language)}</strong><span>{labels.pointLabel} {point.point_number}</span></div>}
      </div>
      <div className="stop-point-actions">
        <Link className="map-panel-feedback" href={pointFeedbackHref(point.id, language)}>{labels.feedback}</Link>
        <Link className="map-panel-comments" href={`${pointFeedbackHref(point.id, language)}#feedback-threads`}
          aria-label={`${labels.comments} · ${labels.pointLabel} ${point.point_number}`} title={labels.comments}><CommentsIcon /></Link>
        {showMapLinks ? <Link className="stop-card-map" href={`/?stop=${encodeURIComponent(placeId)}&point=${encodeURIComponent(point.id)}`}
          aria-label={`${labels.showPointOnMap} · ${point.point_number}`} title={labels.showPointOnMap}>
          <Image src={outlineLocation} width={24} height={24} alt="" aria-hidden="true" />
        </Link> : null}
      </div>
    </li>)}
  </ul>;
}
