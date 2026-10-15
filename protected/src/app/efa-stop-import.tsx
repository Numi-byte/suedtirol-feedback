"use client";

import { useState } from "react";
import { importEfaStopPlaces } from "./actions";

export function EfaStopImport({ labels, pending, onPendingChange }: { labels: { efaButton: string; efaHint: string }; pending: boolean; onPendingChange: (pending: boolean) => void }) {
  const [result, setResult] = useState<{ message: string; error?: boolean }>();
  return <div className="import-form">
    <p>{labels.efaHint}</p>
    <button type="button" disabled={pending} onClick={async () => {
      onPendingChange(true);
      setResult(undefined);
      try {
        const response = await importEfaStopPlaces();
        setResult({ message: response.message, error: response.error });
      } catch {
        setResult({ message: "The import request was interrupted. Some batches may have been saved; retrying is safe.", error: true });
      } finally { onPendingChange(false); }
    }}>{pending ? "…" : labels.efaButton}</button>
    {result && <p className={`import-result ${result.error ? "error" : "success"}`} role={result.error ? "alert" : "status"}>{result.message}</p>}
  </div>;
}
