"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  missingRequiredProfileFields,
  type RequiredProfileField,
} from "@/lib/profile";
import type { ProfileInput } from "@/lib/schemas";

const tourSteps = [
  "profile",
  "profile-ready",
  "advisor",
  "prompt",
  "navigation",
  "goals",
  "done",
] as const;
type TourStep = (typeof tourSteps)[number];

type OnboardingContext = {
  missingFields: RequiredProfileField[];
  tourStep: TourStep;
  setTourStep: (step: TourStep) => void;
  reportSavedProfile: (profile: ProfileInput) => void;
  requestedField: RequiredProfileField | null;
  requestField: (field: RequiredProfileField) => void;
  welcomeOpen: boolean;
  dismissWelcome: () => void;
  profileSetupComplete: boolean;
  finishProfileSetup: () => void;
  preferencesReady: boolean;
};

const Context = createContext<OnboardingContext | null>(null);

export function WorkspaceOnboardingProvider({
  children,
  initialMissingFields,
  storageKey,
  newUser = false,
}: {
  children: React.ReactNode;
  initialMissingFields: RequiredProfileField[];
  storageKey: string;
  newUser?: boolean;
}) {
  const [missingFields, setMissingFields] = useState(initialMissingFields);
  const [tourStep, setStep] = useState<TourStep>("done");
  const [welcomeOpen, setWelcomeOpen] = useState(newUser);
  const dismissWelcome = useCallback(() => setWelcomeOpen(false), []);
  const [profileSetupComplete, setProfileSetupComplete] = useState(
    !newUser && initialMissingFields.length === 0,
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [requestedField, setRequestedField] =
    useState<RequiredProfileField | null>(null);
  const requestField = useCallback(
    (field: RequiredProfileField) => setRequestedField({ ...field }),
    [],
  );

  useEffect(() => {
    let step: TourStep = initialMissingFields.length
      ? "profile"
      : newUser
        ? "advisor"
        : "done";
    let setupComplete = !newUser && initialMissingFields.length === 0;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "prompt-try") step = "prompt";
      else if (tourSteps.includes(stored as TourStep))
        step = stored as TourStep;
      localStorage.setItem(storageKey, step);
      const storedCompletion = localStorage.getItem(
        `${storageKey}:profile-complete`,
      );
      if (storedCompletion !== null)
        setupComplete = storedCompletion === "true";
      localStorage.setItem(
        `${storageKey}:profile-complete`,
        String(setupComplete),
      );
    } catch {
      // Guidance still works for this visit when browser storage is unavailable.
    }
    // Restore presentation preferences after hydration; required fields always come from saved business data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(step);
    setProfileSetupComplete(setupComplete);
    setPreferencesReady(true);
  }, [storageKey, initialMissingFields.length, newUser]);

  const setTourStep = useCallback(
    (step: TourStep) => {
      setStep(step);
      try {
        localStorage.setItem(storageKey, step);
      } catch {
        /* Keep the tour usable without storage. */
      }
    },
    [storageKey],
  );
  const reportSavedProfile = useCallback((profile: ProfileInput) => {
    setMissingFields(missingRequiredProfileFields(profile));
  }, []);
  const finishProfileSetup = useCallback(() => {
    setProfileSetupComplete(true);
    try {
      localStorage.setItem(`${storageKey}:profile-complete`, "true");
    } catch {
      /* Keep the preference for this visit. */
    }
  }, [storageKey]);
  const value = useMemo(
    () => ({
      missingFields,
      tourStep,
      setTourStep,
      reportSavedProfile,
      requestedField,
      requestField,
      welcomeOpen,
      dismissWelcome,
      profileSetupComplete,
      finishProfileSetup,
      preferencesReady,
    }),
    [
      missingFields,
      tourStep,
      setTourStep,
      reportSavedProfile,
      requestedField,
      requestField,
      welcomeOpen,
      dismissWelcome,
      profileSetupComplete,
      finishProfileSetup,
      preferencesReady,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspaceOnboarding() {
  return useContext(Context);
}
