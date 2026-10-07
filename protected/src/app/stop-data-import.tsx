"use client";

import { useState } from "react";
import { StopImportForm } from "./stop-import-form";
import { StopPointImportForm } from "./stop-point-import-form";
import type { StopPointImportLabels } from "./stop-point-import-form";

type ImportLabels = { kicker: string; title: string; subtitle: string; file: string; active: string; submit: string; hint: string };
type PointLabels = StopPointImportLabels & { kicker: string; title: string; subtitle: string; toggleLabel: string; places: string; points: string };

export function StopDataImport({ places, points }: { places: ImportLabels; points: PointLabels }) {
  const [mode, setMode] = useState<"places" | "points">("places");
  const [pending, setPending] = useState(false);
  const current = mode === "places" ? places : points;
  return <>
    <div className="import-toggle" role="group" aria-label={points.toggleLabel}>
      <button type="button" aria-pressed={mode === "places"} onClick={() => setMode("places")} disabled={pending}>{points.places}</button>
      <button type="button" aria-pressed={mode === "points"} onClick={() => setMode("points")} disabled={pending}>{points.points}</button>
    </div>
    <div className="card-heading"><span>{current.kicker}</span><h2>{current.title}</h2><p>{current.subtitle}</p></div>
    {mode === "places"
      ? <StopImportForm labels={places} onPendingChange={setPending} />
      : <StopPointImportForm labels={points} onPendingChange={setPending} />}
  </>;
}
