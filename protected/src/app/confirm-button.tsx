"use client";

import type { ReactNode } from "react";

/** Guards a destructive server action behind a browser confirmation. */
export function ConfirmButton({ className, message, children }: { className?: string; message: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}
    >
      {children}
    </button>
  );
}
