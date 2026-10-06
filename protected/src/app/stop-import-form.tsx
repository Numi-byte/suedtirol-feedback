"use client";

import { FormEvent, useRef, useState } from "react";
import { importStopPlaceBatch } from "./actions";
import { readStopPlaceCsv } from "@/lib/stop-place-csv";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BATCH_SIZE = 250;

export function StopImportForm({ labels }: { labels: { file: string; active: string; submit: string; hint: string } }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: string }>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = inputRef.current?.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) return setResult({ error: "Select a .csv file." });
    if (file.size > MAX_FILE_SIZE) return setResult({ error: "The CSV must be 50 MB or smaller." });
    setPending(true);
    setResult({});
    try {
      // The file is read and parsed only in this browser. Only normalized rows
      // are sent to the server in small batches; localStorage is never used.
      const parseErrors: string[] = [];
      const rows = readStopPlaceCsv(await file.text(), (message) => parseErrors.push(message));
      if (!rows.length) throw new Error("The CSV contains no stops.");
      const published = new FormData(form).get("is_published") === "on";
      let imported = 0;
      let skipped = parseErrors.length;
      const errors: string[] = parseErrors.slice(0, 3);
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const batch = rows.slice(offset, offset + BATCH_SIZE);
        const response = await importStopPlaceBatch(batch, published);
        imported += response.imported;
        skipped += response.skipped;
        errors.push(...response.errors);
        setResult({ success: `${Math.min(offset + BATCH_SIZE, rows.length)} / ${rows.length} valid rows processed…` });
      }
      setResult({ success: `${imported} stops imported${skipped ? `; ${skipped} skipped. ${errors.slice(0, 3).join(" ")}` : "."}` });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "The CSV could not be imported." });
    } finally {
      // Drop the browser's reference to the File immediately after processing.
      // The temporary text/row values then become eligible for garbage collection.
      form.reset();
      if (inputRef.current) inputRef.current.value = "";
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="import-form">
    <label>{labels.file}<input ref={inputRef} name="stop_place" type="file" accept=".csv,text/csv" required /></label>
    <label className="import-check"><input name="is_published" type="checkbox" /> {labels.active}</label>
    <p>{labels.hint}</p>
    {result.error ? <p className="import-result error" role="alert">{result.error}</p> : null}
    {result.success ? <p className="import-result success" role="status">{result.success}</p> : null}
    <button disabled={pending} type="submit">{pending ? "…" : labels.submit}</button>
  </form>;
}
