"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { BusinessDocuments } from "@/components/profile/documents";
import { ProfileSectionEditor } from "@/components/profile/profile-sections";
import {
  emptyBusinessProfile,
  profileCompletion,
  type ProfileSectionKey,
} from "@/lib/profile";
import { profileSchema, type ProfileInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const sections: Array<{
  key: Exclude<ProfileSectionKey, "goals"> | "documents";
  title: string;
  description: string;
}> = [
  {
    key: "basics",
    title: "Business basics",
    description: "Identity, stage, size, and how the business operates.",
  },
  {
    key: "offerings",
    title: "Products and services",
    description: "What you sell, how it is priced, and where customers buy.",
  },
  {
    key: "customers",
    title: "Customers and market",
    description: "Your ideal customer and competitive position.",
  },
  {
    key: "performance",
    title: "Performance",
    description: "Optional ranges and indicators that improve recommendations.",
  },
  {
    key: "operations",
    title: "Operations",
    description: "People, tools, constraints, and time-intensive work.",
  },
  {
    key: "advice",
    title: "Advice preferences",
    description: "How you want your consultant to prioritize and communicate.",
  },
  {
    key: "documents",
    title: "Business documents",
    description: "Private files the consultant can search when relevant.",
  },
];

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";

export function BusinessProfile() {
  const [profile, setProfile] = useState<ProfileInput>(emptyBusinessProfile);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const loaded = useRef(false);
  const version = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "We couldn’t load your profile.");
        return profileSchema.parse(data.profile);
      })
      .then((value) => {
        setProfile(value);
        setSaveState("saved");
        loaded.current = true;
      })
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn’t load your profile.",
        );
        setSaveState("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!loaded.current || !dirty) return;
    const savedVersion = version.current;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      setError("");
      try {
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(profile),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Your profile could not be saved.");
        if (version.current === savedVersion) {
          setDirty(false);
          setSaveState("saved");
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Your profile could not be saved.",
        );
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, profile]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && saveState !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", beforeUnload);
    return () => removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saveState]);

  const completion = useMemo(() => profileCompletion(profile), [profile]);
  const active = sections[activeIndex];

  function changed(next: ProfileInput) {
    version.current += 1;
    setProfile(next);
    setDirty(true);
    setSaveState("idle");
  }

  function setRoot(
    key: "businessName" | "legacyAdditionalInformation",
    value: string,
  ) {
    changed({ ...profile, [key]: value });
  }

  function setField(section: ProfileSectionKey, key: string, value: unknown) {
    const currentSection = profile[section] as unknown as Record<
      string,
      unknown
    >;
    changed({
      ...profile,
      [section]: { ...currentSection, [key]: value },
    } as ProfileInput);
  }

  if (saveState === "loading") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading business profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">
            Business Profile
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Complete one section at a time. Changes save automatically and the
            consultant uses a compact snapshot while keeping details available
            on demand.
          </p>
        </div>
        <div className="min-w-56">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {completion}% complete
            </span>
            <SaveStatus state={saveState} />
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label={`Business profile ${completion}% complete`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
          >
            <div
              className="h-full bg-blue-500 transition-[width]"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[240px_1fr]">
        <nav
          aria-label="Business profile sections"
          className="card overflow-x-auto p-2 lg:sticky lg:top-6"
        >
          <ol className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-1">
            {sections.map((section, index) => (
              <li key={section.key}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-current={activeIndex === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                    activeIndex === index
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      activeIndex === index
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="whitespace-nowrap lg:whitespace-normal">
                    {section.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section
          className="card p-5 sm:p-7"
          aria-labelledby="profile-section-title"
        >
          <div className="border-b border-slate-100 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Section {activeIndex + 1} of {sections.length}
            </p>
            <h2
              id="profile-section-title"
              className="mt-1 text-xl font-semibold text-slate-950"
            >
              {active.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{active.description}</p>
          </div>

          <div className="mt-6">
            {active.key === "documents" ? (
              <BusinessDocuments />
            ) : (
              <ProfileSectionEditor
                section={active.key}
                profile={profile}
                setRoot={setRoot}
                setField={setField}
              />
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            <button
              type="button"
              className="btn-secondary"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="size-4" /> Previous
            </button>
            {activeIndex < sections.length - 1 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setActiveIndex((index) =>
                    Math.min(sections.length - 1, index + 1),
                  )
                }
              >
                Next <ChevronRight className="size-4" />
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Check className="size-4" /> Profile review complete
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span role="status" className="flex items-center gap-1 text-slate-500">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  if (state === "error") return <span className="text-red-700">Not saved</span>;
  if (state === "idle")
    return <span className="text-slate-500">Changes pending</span>;
  return (
    <span role="status" className="flex items-center gap-1 text-emerald-700">
      <Check className="size-3.5" /> Saved
    </span>
  );
}
