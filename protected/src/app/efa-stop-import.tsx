"use client";

import { useState } from "react";
import { importEfaStopPlaces } from "./actions";

export function EfaStopImport({ labels, pending, onPendingChange }: { labels: { efaButton: string; efaHint: string }; pending: boolean; onPendingChange: (pending: boolean) => void }) {
  const [result, setResult] = useState<{ message: string; error?: boolean; details?: string[] }>();
  return <div className="import-form">
    <p>{labels.efaHint}</p>
    <button type="button" disabled={pending} onClick={async () => {
      onPendingChange(true);
      setResult(undefined);
      try {
        const response = await importEfaStopPlaces();
        setResult(response);
      } catch {
        setResult({ message: "The import request was interrupted. Some batches may have been saved; retrying is safe.", error: true });
      } finally { onPendingChange(false); }
    }}>{pending ? "…" : labels.efaButton}</button>
    {result && <p className={`import-result ${result.error ? "error" : "success"}`} role={result.error ? "alert" : "status"}>{result.message}</p>}
    {!!result?.details?.length && <button type="button" onClick={() => {
      const url = URL.createObjectURL(new Blob([result.details!.join("\n")], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "efa-import-issues.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }}>Download all {result.details.length} import issues</button>}
  </div>;
}
