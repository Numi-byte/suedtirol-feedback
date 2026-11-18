"use client";
import { useRef, useState } from "react";
import { prepareMunicipalityBackfill, applyMunicipalityBackfillBatch } from "./municipality-actions";
import type { MunicipalityIssue } from "@/lib/municipality-backfill";
import { municipalityBackfillCopy } from "@/lib/municipality-backfill-copy";
import type { Language } from "@/lib/i18n";

export function MunicipalityBackfill({ language, referenceDate }: { language: Language; referenceDate: string }) {
  const copy = municipalityBackfillCopy[language];
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ scanned: number; updated: number; issues: MunicipalityIssue[]; done: boolean; failed: boolean }>();
  async function run() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    let updated = 0;
    let scanned = 0;
    const issues: MunicipalityIssue[] = [];
    setResult(undefined);
    try {
      const plan = await prepareMunicipalityBackfill();
      scanned = plan.scanned;
      issues.push(...plan.issues);
      setResult({ scanned, updated, issues: [...issues], done: false, failed: false });
      for (let offset = 0; offset < plan.candidates.length; offset += 250) {
        const batch = await applyMunicipalityBackfillBatch(plan.candidates.slice(offset, offset + 250));
        updated += batch.updated;
        issues.push(...batch.details);
        setResult({ scanned, updated, issues: [...issues], done: false, failed: false });
      }
      setResult({ scanned, updated, issues, done: true, failed: false });
    } catch {
      setResult({ scanned, updated, issues, done: false, failed: true });
    } finally {
      running.current = false;
      setPending(false);
    }
  }
  return <div className="municipality-backfill" aria-busy={pending}>
    <p>{copy.hint}</p><small>{copy.verified} {referenceDate} · <a href="https://github.com/italia/anpr/blob/master/src/archivi/ANPR_archivio_comuni.csv" target="_blank" rel="noreferrer">ANPR (CC BY 4.0)</a></small>
    <button type="button" onClick={run} disabled={pending}>{pending ? copy.working : copy.run}</button>
    {result ? <p role={result.failed ? "alert" : "status"}>{result.failed ? copy.failed : result.done ? copy.completed : copy.working} {result.scanned} {copy.scanned} · {result.updated} {copy.updated} · {result.issues.length} {copy.review}</p> : null}
    {!!result?.issues.length ? <button type="button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.issues, null, 2)], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "municipality-review.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }}>{copy.download}</button> : null}
  </div>;
}
