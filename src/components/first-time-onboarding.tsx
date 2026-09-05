"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

export function FirstTimeOnboarding({ show }: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback(
    async (destination?: string) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/onboarding", { method: "PATCH" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Your welcome preference could not be saved.",
          );
        }
        setOpen(false);
        if (destination) router.push(destination);
        router.refresh();
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Your welcome preference could not be saved.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, router],
  );

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        void finish();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [busy, finish, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        type="button"
        className="msa-dialog-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close welcome"
        disabled={busy}
        onClick={() => void finish()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="msa-dialog-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Welcome · Step {step} of 2
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {step === 1 ? (
            <>
              <div className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Sparkles className="size-6" aria-hidden="true" />
              </div>
              <h2
                id={titleId}
                className="mt-5 text-2xl font-semibold text-slate-950"
              >
                Meet your AI business advisor
              </h2>
              <p
                id={descriptionId}
                className="mt-3 text-sm leading-6 text-slate-600"
              >
                Ask for personalized guidance, then turn useful recommendations
                into an organized goal and task list you can review before
                saving.
              </p>
            </>
          ) : (
            <>
              <div className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <BriefcaseBusiness className="size-6" aria-hidden="true" />
              </div>
              <h2
                id={titleId}
                className="mt-5 text-2xl font-semibold text-slate-950"
              >
                Add a little business context
              </h2>
              <p
                id={descriptionId}
                className="mt-3 text-sm leading-6 text-slate-600"
              >
                Complete your Business Profile so the advisor can give advice
                that better fits your customers, services, and situation.
              </p>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error} You can continue now, but this welcome may appear again.
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {error ? (
            <button
              ref={closeButtonRef}
              type="button"
              className="btn-ghost"
              onClick={() => setOpen(false)}
            >
              Continue for now
            </button>
          ) : (
            <button
              ref={closeButtonRef}
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void finish()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Close
            </button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step === 2 && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                <ArrowLeft className="size-4" /> Back
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
              >
                Next <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void finish("/app/profile")}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Set Up Business Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
