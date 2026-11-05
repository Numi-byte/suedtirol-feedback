"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { databaseSelectionHref, type StopMutationResult } from "@/lib/database-navigation";

type Props = {
  action: (data: FormData) => Promise<StopMutationResult>;
  labels: { saving: string; saved: string; failed: string };
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
};

/** Submit without native form resets or a redirect that discards list context. */
export function StopMutationForm({ action, labels, children, className = "", confirmMessage }: Props) {
  const router = useRouter();
  // Never allow a native submit before the inline handler has hydrated.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [result, setResult] = useState<StopMutationResult>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || (confirmMessage && !window.confirm(confirmMessage))) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const response = await action(data);
        setResult(response);
        // Existing saves keep the URL/scroll untouched. Create/archive only
        // adjust selection, retaining the search and both pagination controls.
        if (response.createdId) {
          router.replace(databaseSelectionHref(window.location.search, response.createdId), { scroll: false });
        } else if (response.archivedId && new URLSearchParams(window.location.search).get("stop") === response.archivedId) {
          router.replace(databaseSelectionHref(window.location.search, null), { scroll: false });
        }
      } catch {
        setResult({ error: labels.failed });
      } finally {
        submitting.current = false;
      }
    });
  }

  return <form className={`stop-mutation-form ${className}`} method="post" onSubmit={submit} aria-busy={pending}
    onChange={() => setResult({})}>
    <fieldset disabled={!ready || pending}>{children}</fieldset>
    {pending || result.success ? <p className="stop-save-status" role="status">{pending ? labels.saving : labels.saved}</p> : null}
    {result.error ? <p className="stop-save-error" role="alert">{result.error}</p> : null}
  </form>;
}
