"use client";

import { useState } from "react";

/** Falls back to selecting the text when the clipboard API is unavailable. */
export function CopySummary({ summary, label, copiedLabel }: { summary: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="thanks-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(summary);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
