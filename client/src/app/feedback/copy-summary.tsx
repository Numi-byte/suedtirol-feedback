"use client";

import { useEffect, useRef, useState } from "react";

function copyWithFallback(value: string) {
  const previouslyFocused = document.activeElement;
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textArea.remove();
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  }

  if (!copied) throw new Error("Copy command was rejected");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Clipboard access can be denied outside a secure context. Use the
      // selection-based fallback below so the control still works there.
    }
  }

  copyWithFallback(value);
}

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
  </svg>
);

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 4 4L19 6" />
  </svg>
);

export function CopySummary({ summary, label, copiedLabel }: { summary: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const handleCopy = async () => {
    try {
      await copyText(summary);
      setCopied(true);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`thanks-copy${copied ? " is-copied" : ""}`}
        onClick={handleCopy}
        aria-label={copied ? copiedLabel : label}
        title={copied ? copiedLabel : label}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
