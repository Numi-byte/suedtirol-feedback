"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { importStopPointBatch } from "./actions";
import { readStopPointCsv } from "@/lib/stop-point-csv";

export type StopPointImportLabels = { file: string; submit: string; hint: string };

export function StopPointImportForm({ labels, onPendingChange }: {
  labels: StopPointImportLabels;
  onPendingChange: (pending: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [issues, setIssues] = useState<string[]>([]);

  function downloadIssues() {
    const url = URL.createObjectURL(new Blob([issues.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "stop-point-import-issues.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = inputRef.current?.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) return setResult({ error: "Select a .csv file." });
    if (file.size > 50 * 1024 * 1024) return setResult({ error: "The CSV file must be 50 MB or smaller." });
    setPending(true);
    onPendingChange(true);
    setResult({});
    setIssues([]);
    let imported = 0;
    try {
      const details: string[] = [];
      const rows = readStopPointCsv(await file.text(), (message) => details.push(message));
      const invalid = details.length;
      setIssues([...details]);
      if (!rows.length) throw new Error(`The CSV file contains no valid stop points. ${details.slice(0, 3).join(" ")}`);
      let unmatched = 0;
      for (let offset = 0; offset < rows.length; offset += 250) {
        const response = await importStopPointBatch(rows.slice(offset, offset + 250));
        imported += response.imported;
        unmatched += response.unmatched;
        details.push(...response.errors);
        setIssues([...details]);
        setResult({ success: `${Math.min(offset + 250, rows.length)} / ${rows.length} valid points processed…` });
      }
      setResult({ success: `${imported} stop points inserted or updated; ${invalid} invalid CSV rows; ${unmatched} points without a unique matching stop place. ${details.slice(0, 3).join(" ")}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The CSV file could not be imported.";
      setResult({ error: `${imported} points inserted or updated before the import stopped. ${message} You can safely retry the file.` });
    } finally {
      form.reset();
      setPending(false);
      onPendingChange(false);
    }
  }

  return <form className="import-form" onSubmit={submit}>
    <label>{labels.file}<input ref={inputRef} type="file" name="stop_points" accept=".csv,text/csv" required disabled={pending} /></label>
    <p>{labels.hint}</p>
    {result.error && <p className="import-result error" role="alert">{result.error}</p>}
    {result.success && <p className="import-result success" role="status">{result.success}</p>}
    {issues.length > 0 && <button type="button" onClick={downloadIssues}>Download all {issues.length} import issues</button>}
    <button type="submit" disabled={pending}>{pending ? "…" : labels.submit}</button>
  </form>;
}
