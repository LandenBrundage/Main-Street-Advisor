"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { BusinessDocuments } from "@/components/profile/documents";
import { ProfileSectionEditor } from "@/components/profile/profile-sections";
import {
  emptyBusinessProfile,
  profileCompletion,
  missingRequiredProfileFields,
  type ProfileSectionKey,
} from "@/lib/profile";
import { profileSchema, type ProfileInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useWorkspaceOnboarding } from "@/components/workspace-onboarding";
import { OnboardingDialog } from "@/components/onboarding-dialog";

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
  const router = useRouter();
  const onboarding = useWorkspaceOnboarding();
  const reportSavedProfile = onboarding?.reportSavedProfile;
  const requestedField = onboarding?.requestedField;
  const [profile, setProfile] = useState<ProfileInput>(emptyBusinessProfile);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const version = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const lastSavedVersion = useRef(0);
  const inFlight = useRef<{
    version: number;
    promise: Promise<boolean>;
  } | null>(null);
  const fieldContainer = useRef<HTMLDivElement>(null);

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
        setHasLoaded(true);
        reportSavedProfile?.(value);
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
  }, [reportSavedProfile, loadAttempt]);

  const persistProfile = useCallback(
    (snapshot: ProfileInput, savedVersion: number): Promise<boolean> => {
      if (inFlight.current?.version === savedVersion)
        return inFlight.current.promise;
      const promise = saveQueue.current.then(async () => {
        if (savedVersion !== version.current) return false;
        if (lastSavedVersion.current === savedVersion) return true;
        setSaveState("saving");
        setError("");
        try {
          const response = await fetch("/api/profile", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(snapshot),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Your profile could not be saved.");
          if (version.current !== savedVersion) return false;
          lastSavedVersion.current = savedVersion;
          setDirty(false);
          setSaveState("saved");
          reportSavedProfile?.(snapshot);
          return true;
        } catch (reason) {
          if (version.current === savedVersion) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Your profile could not be saved.",
            );
            setSaveState("error");
          }
          return false;
        }
      });
      inFlight.current = { version: savedVersion, promise };
      saveQueue.current = promise;
      void promise.then(() => {
        if (inFlight.current?.promise === promise) inFlight.current = null;
      });
      return promise;
    },
    [reportSavedProfile],
  );

  useEffect(() => {
    if (!hasLoaded || !dirty) return;
    const savedVersion = version.current;
    saveTimer.current = setTimeout(
      () => void persistProfile(profile, savedVersion),
      800,
    );
    return () => clearTimeout(saveTimer.current);
  }, [dirty, profile, persistProfile, hasLoaded]);

  useEffect(() => {
    if (!requestedField || !hasLoaded) return;
    // A sidebar reminder can target a required field in another profile section.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(
      sections.findIndex((section) => section.key === requestedField.section),
    );
    const timer = setTimeout(
      () => document.getElementById(requestedField.id)?.focus(),
      0,
    );
    return () => clearTimeout(timer);
  }, [requestedField, hasLoaded]);

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
  const missingFields = missingRequiredProfileFields(profile);
  const active = sections[activeIndex];

  function changed(next: ProfileInput) {
    version.current += 1;
    setProfile(next);
    setDirty(true);
    setSaveState("idle");
  }

  function showRequiredField() {
    const first = missingFields[0];
    if (!first) return;
    setShowMissing(false);
    setActiveIndex(
      sections.findIndex((section) => section.key === first.section),
    );
    setTimeout(() => document.getElementById(first.id)?.focus(), 0);
  }

  async function continueToAdvisor() {
    if (continuing) return;
    if (missingFields.length) {
      setShowMissing(true);
      return;
    }
    const invalidField = fieldContainer.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(":invalid");
    if (invalidField) {
      invalidField.reportValidity();
      return;
    }
    setContinuing(true);
    clearTimeout(saveTimer.current);
    const saved = await persistProfile(profile, version.current);
    if (saved) {
      onboarding?.finishProfileSetup();
      if (onboarding && onboarding.tourStep !== "done")
        onboarding.setTourStep("advisor");
      router.push("/app");
    }
    setContinuing(false);
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

  if (!hasLoaded) {
    return (
      <div role="alert" className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => {
            setSaveState("loading");
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Try loading again
        </button>
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
            Business details help your advisor tailor its recommendations.
            Changes save automatically.
          </p>
        </div>
        <div className="min-w-56">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {completion}% of required details
            </span>
            <SaveStatus state={saveState} />
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label={`Required business profile details ${completion}% complete`}
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

      <OnboardingDialog
        open={Boolean(
          onboarding?.preferencesReady &&
          !onboarding.profileSetupComplete &&
          completion === 100 &&
          !dirty &&
          saveState === "saved" &&
          onboarding.missingFields.length === 0,
        )}
        title="You’re ready to start"
        eyebrow="Business Profile · Setup complete"
        closeLabel="Keep editing"
        nextLabel="Continue to advisor"
        busy={continuing}
        onClose={() => onboarding?.finishProfileSetup()}
        onNext={() => void continueToAdvisor()}
      >
        Your required details are saved. Start a conversation with your advisor,
        or add optional information whenever you like.
      </OnboardingDialog>
      <OnboardingDialog
        open={showMissing && missingFields.length > 0}
        title="Add the required details"
        eyebrow="Business Profile"
        nextLabel="Go to next required field"
        onClose={() => setShowMissing(false)}
        onNext={showRequiredField}
      >
        Complete the fields marked Required before continuing. Optional
        information and file uploads can wait.
      </OnboardingDialog>

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

          <div ref={fieldContainer} className="mt-6">
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

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
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
              <button
                type="button"
                className="btn-primary"
                disabled={continuing}
                onClick={() => void continueToAdvisor()}
              >
                {continuing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Continue to advisor
              </button>
            )}
          </div>
          {active.key === "documents" && (
            <p className="mt-3 text-right text-xs leading-5 text-slate-500">
              No upload is needed. Continue to the advisor to start your first
              conversation.
            </p>
          )}
          {saveState === "error" && (
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => {
                inFlight.current = null;
                void persistProfile(profile, version.current);
              }}
            >
              Retry saving
            </button>
          )}
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
