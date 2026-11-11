"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { UserManagementResult } from "@/lib/user-management";
import { UserForm } from "../users/user-form";

export function SettingsDialog({
  title,
  closeLabel,
  resetLabel,
  action,
  labels,
  children,
  resetOnSuccess = false,
  disabled = false,
}: {
  title: string;
  closeLabel: string;
  resetLabel: string;
  action: (form: FormData) => Promise<UserManagementResult>;
  labels: { saving: string; saved: string; failed: string };
  children: ReactNode;
  resetOnSuccess?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!open) return;
    const current = dialog.current!;
    const opener = trigger.current;
    const overflow = document.body.style.overflow;
    current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      current.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);
  function close() {
    if (!busy.current) setOpen(false);
  }
  async function save(form: FormData) {
    busy.current = true;
    setPending(true);
    try {
      return await action(form);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="feedback-settings-dialog-trigger"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {title}
      </button>
      <dialog
        ref={dialog}
        className="category-order-dialog feedback-settings-dialog"
        aria-labelledby={id}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }}
      >
        <header className="category-order-heading">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="category-order-close"
            aria-label={closeLabel}
            disabled={pending}
            onClick={close}
            autoFocus
          >
            ×
          </button>
        </header>
        <div className="feedback-settings-dialog-body">
          {open ? (
            <UserForm
              key={version}
              action={save}
              labels={labels}
              clearUploads
              resetOnSuccess={resetOnSuccess}
            >
              {children}
            </UserForm>
          ) : null}
        </div>
        <footer className="category-order-actions">
          <button
            type="button"
            className="category-order-reset"
            disabled={pending}
            onClick={() => setVersion((value) => value + 1)}
          >
            {resetLabel}
          </button>
        </footer>
      </dialog>
    </>
  );
}
