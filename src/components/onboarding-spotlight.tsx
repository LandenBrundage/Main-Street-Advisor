"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useWorkspaceOnboarding } from "@/components/workspace-onboarding";

type Geometry = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  targetId: string;
};
const subscribe = () => () => {};

export function OnboardingSpotlight({
  open = true,
  targetSelector,
  title,
  eyebrow,
  children,
  nextLabel,
  onNext,
  onClose,
  interactiveTarget = true,
}: {
  open?: boolean;
  targetSelector: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  nextLabel: string;
  onNext: () => void;
  onClose: () => void;
  interactiveTarget?: boolean;
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
  const generatedTargetId = useId();
  const target = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeAction = useRef(onClose);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [cardHeight, setCardHeight] = useState(260);
  const hasTarget = geometry !== null;

  useEffect(() => {
    closeAction.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    let restoreTarget = () => {};
    const update = () => {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>(targetSelector),
      ).find((item) => item.getClientRects().length > 0);
      if (!element) return;
      if (element !== target.current) {
        restoreTarget();
        const previousId = element.id;
        const previousDescription = element.getAttribute("aria-describedby");
        const previousInert = element.inert === true;
        const previousTabIndex = element.getAttribute("tabindex");
        const previousDisabled = element.getAttribute("aria-disabled");
        const blockActivation = (event: Event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        if (!interactiveTarget) {
          element.inert = true;
          element.setAttribute("tabindex", "-1");
          element.setAttribute("aria-disabled", "true");
          element.addEventListener("click", blockActivation, true);
        }
        if (!element.id) element.id = `tour-target-${generatedTargetId}`;
        element.setAttribute(
          "aria-describedby",
          [previousDescription, descriptionId].filter(Boolean).join(" "),
        );
        target.current = element;
        restoreTarget = () => {
          if (!previousId) element.removeAttribute("id");
          if (previousDescription === null)
            element.removeAttribute("aria-describedby");
          else element.setAttribute("aria-describedby", previousDescription);
          if (!interactiveTarget) {
            element.inert = previousInert;
            if (previousTabIndex === null) element.removeAttribute("tabindex");
            else element.setAttribute("tabindex", previousTabIndex);
            if (previousDisabled === null)
              element.removeAttribute("aria-disabled");
            else element.setAttribute("aria-disabled", previousDisabled);
            element.removeEventListener("click", blockActivation, true);
          }
        };
        element.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
        if (interactiveTarget) element.focus({ preventScroll: true });
      }
      const rect = element.getBoundingClientRect();
      const next: Geometry = {
        top: Math.max(8, rect.top - 8),
        left: Math.max(8, rect.left - 8),
        right: Math.min(innerWidth - 8, rect.right + 8),
        bottom: Math.min(innerHeight - 8, rect.bottom + 8),
        width: innerWidth,
        height: innerHeight,
        targetId: element.id,
      };
      setGeometry((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof Geometry] === next[key as keyof Geometry],
        )
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // A collapsed mobile sidebar mounts its target after the tour step changes.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAction.current();
      }
      if (event.key !== "Tab" || !target.current) return;
      const controls = [
        ...(interactiveTarget ? [target.current] : []),
        ...Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled])",
          ) || [],
        ),
      ];
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[
        (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      ]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("keydown", onKeyDown);
      restoreTarget();
      target.current = null;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [
    visible,
    targetSelector,
    generatedTargetId,
    descriptionId,
    interactiveTarget,
  ]);

  useEffect(() => {
    if (!visible || !hasTarget || !panel.current) return;
    if (!interactiveTarget)
      panel.current.querySelector<HTMLButtonElement>("button")?.focus();
    const observer = new ResizeObserver(([entry]) =>
      setCardHeight(entry.target.getBoundingClientRect().height),
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [visible, hasTarget, interactiveTarget]);

  if (!visible || !geometry) return null;
  const width = Math.min(384, geometry.width - 32);
  const above = geometry.top >= cardHeight + 32;
  const top = above
    ? geometry.top - cardHeight - 16
    : Math.max(
        16,
        Math.min(geometry.height - cardHeight - 16, geometry.bottom + 16),
      );
  const left = Math.max(
    16,
    Math.min(
      geometry.width - width - 16,
      (geometry.left + geometry.right - width) / 2,
    ),
  );
  const shade =
    "pointer-events-auto absolute bg-slate-950/45 backdrop-blur-[2px]";
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <div
        aria-hidden="true"
        className={shade}
        style={{ inset: `0 0 auto 0`, height: geometry.top }}
      />
      <div
        aria-hidden="true"
        className={shade}
        style={{ inset: `${geometry.bottom}px 0 0 0` }}
      />
      <div
        aria-hidden="true"
        className={shade}
        style={{
          top: geometry.top,
          left: 0,
          width: geometry.left,
          height: geometry.bottom - geometry.top,
        }}
      />
      <div
        aria-hidden="true"
        className={shade}
        style={{
          top: geometry.top,
          left: geometry.right,
          right: 0,
          height: geometry.bottom - geometry.top,
        }}
      />
      <div
        aria-hidden="true"
        className={`absolute rounded-xl border-2 border-blue-400 shadow-lg ${interactiveTarget ? "" : "pointer-events-auto"}`}
        style={{
          top: geometry.top,
          left: geometry.left,
          width: geometry.right - geometry.left,
          height: geometry.bottom - geometry.top,
        }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-owns={interactiveTarget ? geometry.targetId : undefined}
        className="pointer-events-auto absolute max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ top, left, width }}
      >
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            {eyebrow}
          </p>
        </div>
        <div className="p-5">
          <h2 id={titleId} className="text-xl font-semibold text-slate-950">
            {title}
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-slate-600"
          >
            {children}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
