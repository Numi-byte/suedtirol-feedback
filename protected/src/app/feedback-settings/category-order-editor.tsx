"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { FeedbackCategoryIcon } from "@/components/feedback-category-icon";
import type { Language } from "@/lib/i18n";
import type { feedbackSettingsCopy } from "@/lib/feedback-settings-copy";
import type { FeedbackCategoryConfig } from "../../../../shared/feedback-form-config";
import { saveCategoryOrder } from "./actions";

type Copy = (typeof feedbackSettingsCopy)[Language];
export function CategoryOrderEditor({
  categories,
  language,
  copy,
}: {
  categories: FeedbackCategoryConfig[];
  language: Language;
  copy: Copy;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const drag = useRef<string | null>(null);
  const openingOrder = useRef<string[]>([]);
  const saving = useRef(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackCategoryConfig[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"changed" | "denied" | "failed" | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const changed = draft.some(
    (category, index) => category.slug !== openingOrder.current[index],
  );

  useEffect(() => {
    if (!open) return;
    const current = dialog.current!;
    const opener = trigger.current;
    current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      current.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  function show() {
    openingOrder.current = categories.map((category) => category.slug);
    setDraft([...categories]);
    setError(null);
    setAnnouncement("");
    setOpen(true);
  }
  function cancel() {
    if (saving.current) return;
    drag.current = null;
    setDragging(null);
    setOpen(false);
    setDraft([]);
    setError(null);
  }
  function move(slug: string, to: number) {
    if (saving.current) return;
    setDraft((current) => {
      const from = current.findIndex((category) => category.slug === slug);
      const target = Math.max(0, Math.min(current.length - 1, to));
      if (from === -1 || from === target) return current;
      const next = [...current];
      const [category] = next.splice(from, 1);
      next.splice(target, 0, category);
      return next;
    });
    setAnnouncement(copy.orderMoved);
  }
  function keyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    slug: string,
    index: number,
  ) {
    const targets: Record<string, number> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      Home: 0,
      End: draft.length - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    move(slug, targets[event.key]);
  }
  function pointerStart(event: PointerEvent<HTMLButtonElement>, slug: string) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      saving.current ||
      error === "changed"
    )
      return;
    list.current?.setPointerCapture(event.pointerId);
    drag.current = slug;
    setDragging(slug);
  }
  function pointerMove(event: PointerEvent<HTMLOListElement>) {
    if (!drag.current || saving.current) return;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-category-slug]");
    if (row && list.current?.contains(row)) {
      const target = draft.findIndex(
        (category) => category.slug === row.dataset.categorySlug,
      );
      if (target >= 0 && row.dataset.categorySlug !== drag.current)
        move(drag.current, target);
    }
    if (list.current) {
      const bounds = list.current.getBoundingClientRect();
      if (event.clientY < bounds.top + 40) list.current.scrollTop -= 16;
      else if (event.clientY > bounds.bottom - 40) list.current.scrollTop += 16;
    }
  }
  function pointerEnd() {
    drag.current = null;
    setDragging(null);
  }
  function reset() {
    if (saving.current) return;
    pointerEnd();
    setDraft((current) =>
      [...current].sort(
        (a, b) =>
          openingOrder.current.indexOf(a.slug) -
          openingOrder.current.indexOf(b.slug),
      ),
    );
    setAnnouncement("");
  }
  async function save() {
    if (saving.current || !changed || error === "changed") return;
    saving.current = true;
    setPending(true);
    setError(null);
    pointerEnd();
    try {
      const result = await saveCategoryOrder(
        draft.map((category) => category.slug),
        openingOrder.current,
      );
      if (result.error) {
        setError(result.error);
        if (result.error === "changed") router.refresh();
      } else {
        setOpen(false);
        setDraft([]);
      }
    } catch {
      setError("failed");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        className="category-order-trigger"
        type="button"
        onClick={show}
        aria-haspopup="dialog"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M8 4v16m0-16L4 8m4-4 4 4M16 20V4m0 16 4-4m-4 4-4-4" />
        </svg>
        {copy.orderTitle}
      </button>
      <dialog
        ref={dialog}
        className="category-order-dialog"
        aria-labelledby="category-order-title"
        aria-describedby="category-order-help"
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              cancel();
          }
        }}
      >
        <header className="category-order-heading">
          <h2 id="category-order-title">{copy.orderTitle}</h2>
          <button
            type="button"
            className="category-order-close"
            aria-label={copy.orderClose}
            onClick={cancel}
            disabled={pending}
            autoFocus
          >
            ×
          </button>
          <p id="category-order-help">{copy.orderHelp}</p>
        </header>
        <ol
          ref={list}
          className="category-order-list"
          aria-busy={pending}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onLostPointerCapture={pointerEnd}
        >
          {draft.map((category, index) => {
            const label = category[`label_${language}`];
            const disabled =
              pending || error === "changed" || error === "denied";
            return (
              <li
                key={category.slug}
                data-category-slug={category.slug}
                className={dragging === category.slug ? "is-dragging" : ""}
              >
                <button
                  type="button"
                  className="category-drag-handle"
                  aria-label={copy.orderDrag.replace("{category}", label)}
                  disabled={disabled}
                  onPointerDown={(event) => pointerStart(event, category.slug)}
                  onKeyDown={(event) => keyboard(event, category.slug, index)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    {[7, 12, 17].flatMap((y) =>
                      [9, 15].map((x) => (
                        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
                      )),
                    )}
                  </svg>
                </button>
                <span className="category-icon-preview">
                  <FeedbackCategoryIcon
                    slug={category.slug}
                    icon={category.icon}
                  />
                </span>
                <span className="category-order-label">
                  {label}
                  {!category.is_active ? (
                    <small>{copy.orderInactive}</small>
                  ) : null}
                </span>
                <div className="category-order-arrows">
                  <button
                    type="button"
                    aria-label={copy.orderUp.replace("{category}", label)}
                    disabled={disabled || index === 0}
                    onClick={() => move(category.slug, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={copy.orderDown.replace("{category}", label)}
                    disabled={disabled || index === draft.length - 1}
                    onClick={() => move(category.slug, index + 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <span className="sr-only" role="status">
          {announcement}
        </span>
        {error ? (
          <p className="category-order-error" role="alert">
            {error === "changed"
              ? copy.orderChanged
              : error === "denied"
                ? copy.orderDenied
                : copy.failed}
          </p>
        ) : null}
        <footer className="category-order-actions">
          <button
            type="button"
            className="category-order-reset"
            onClick={reset}
            disabled={pending || !changed}
          >
            {copy.orderReset}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={
              pending || !changed || error === "changed" || error === "denied"
            }
          >
            {pending ? copy.saving : copy.orderSave}
          </button>
        </footer>
      </dialog>
    </>
  );
}
