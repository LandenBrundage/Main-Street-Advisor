"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  error = "",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <button
        type="button"
        className="msa-dialog-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Cancel deletion"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="msa-dialog-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 p-6 pb-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-slate-950">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close confirmation"
            disabled={busy}
            onClick={onCancel}
          >
            <X className="size-4" />
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mx-6 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelButton}
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
