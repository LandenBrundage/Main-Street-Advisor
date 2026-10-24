"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { useWorkspaceOnboarding } from "@/components/workspace-onboarding";

const subscribe = () => () => {};

export function OnboardingDialog({
  open = true,
  title,
  children,
  onNext,
  nextLabel = "Next",
  onClose,
  closeLabel = "Close",
  eyebrow = "Getting started",
  busy = false,
}: {
  open?: boolean;
  title: string;
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  onClose: () => void;
  closeLabel?: string;
  eyebrow?: string;
  busy?: boolean;
}) {
  const onboarding = useWorkspaceOnboarding();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const visible = open && hydrated && !onboarding?.welcomeOpen;
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeAction = useRef(onClose);
  const isBusy = useRef(busy);
  useEffect(() => {
    closeAction.current = onClose;
    isBusy.current = busy;
  }, [onClose, busy]);
  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy.current) {
        event.preventDefault();
        closeAction.current();
      }
      if (event.key !== "Tab") return;
      const buttons = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex="0"]',
        ) || [],
      );
      if (!buttons.length) {
        event.preventDefault();
        return;
      }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [visible, title]);

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        className="msa-dialog-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label={`Close ${title}`}
        disabled={busy}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="msa-dialog-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            {eyebrow}
          </p>
        </div>
        <div className="overflow-y-auto p-6 sm:p-8">
          <div className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Sparkles className="size-6" aria-hidden="true" />
          </div>
          <h2
            id={titleId}
            className="mt-5 text-2xl font-semibold text-slate-950"
          >
            {title}
          </h2>
          <div
            id={descriptionId}
            className="mt-3 text-sm leading-6 text-slate-600"
          >
            {children}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            ref={closeButton}
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onClose}
          >
            {closeLabel}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={onNext}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {nextLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
