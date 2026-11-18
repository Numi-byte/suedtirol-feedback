"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { UserManagementResult } from "@/lib/user-management";

type Props = { action: (form: FormData) => Promise<UserManagementResult>; children: ReactNode; resetOnSuccess?: boolean; clearUploads?:boolean; disabled?: boolean; labels: { saving: string; saved: string; failed: string } };
export function UserForm({ action, children, labels, resetOnSuccess = false, clearUploads = false, disabled = false }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UserManagementResult>({});
  const submitting = useRef(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const response = await action(data);
        setResult(response);
        if (response.success && resetOnSuccess) form.reset();
        if (response.success && clearUploads) {
          form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input=>{input.value="";});
          form.querySelectorAll<HTMLInputElement>('input[name="remove_icon"]').forEach(input=>{input.checked=false;});
        }
      } catch {
        setResult({ error: labels.failed });
      } finally {
        // Passwords are never returned by the server or left visible after an attempt.
        form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = ""; });
        submitting.current = false;
      }
    });
  }
  return <form method="post" className="user-management-form" onSubmit={submit} aria-busy={pending} onChange={() => setResult({})}>
    <fieldset disabled={!ready || pending || disabled}>{children}</fieldset>
    {pending || result.success ? <p role="status">{pending ? labels.saving : labels.saved}</p> : null}
    {result.warning ? <p role="status">{result.warning}</p> : null}
    {result.error ? <p className="stop-save-error" role="alert">{result.error}</p> : null}
  </form>;
}
