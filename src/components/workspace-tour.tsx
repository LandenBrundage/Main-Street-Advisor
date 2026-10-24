"use client";

import { OnboardingDialog } from "@/components/onboarding-dialog";
import { OnboardingSpotlight } from "@/components/onboarding-spotlight";
import { useWorkspaceOnboarding } from "@/components/workspace-onboarding";

export function AdvisorGuide() {
  const onboarding = useWorkspaceOnboarding();
  if (
    !onboarding ||
    !["profile", "profile-ready", "advisor"].includes(onboarding.tourStep)
  )
    return null;
  return (
    <OnboardingDialog
      title="Your advisor is ready"
      eyebrow="Your workspace · Step 1 of 3"
      nextLabel="Show prompt builder"
      onClose={() => onboarding.setTourStep("done")}
      onNext={() => onboarding.setTourStep("prompt")}
    >
      Talk through a business challenge, explore ideas for growth, or make a
      decision. Your advisor can also suggest goals and tasks, which you review
      before saving.
    </OnboardingDialog>
  );
}

export function PromptGuide() {
  const onboarding = useWorkspaceOnboarding();
  if (onboarding?.tourStep !== "prompt") return null;
  return (
    <OnboardingSpotlight
      title="Need help asking your question?"
      targetSelector='[data-tour-target="prompt-builder"]'
      interactiveTarget={false}
      eyebrow="Your workspace · Step 2 of 3"
      nextLabel="Next"
      onClose={() => onboarding.setTourStep("done")}
      onNext={() => onboarding.setTourStep("navigation")}
    >
      The Prompt builder button helps you turn a goal or challenge into a clear
      question. You can use it after the tour.
    </OnboardingSpotlight>
  );
}

export function GoalsGuide() {
  const onboarding = useWorkspaceOnboarding();
  if (!onboarding || !["goals", "navigation"].includes(onboarding.tourStep))
    return null;
  return (
    <OnboardingDialog
      title="Turn advice into progress"
      eyebrow="Goals & Tasks"
      nextLabel="View goals and tasks"
      onClose={() => onboarding.setTourStep("done")}
      onNext={() => onboarding.setTourStep("done")}
    >
      Goals capture what you want to achieve. Tasks break each goal into smaller
      actions with priorities and due dates. Create your own or save an approved
      plan from chat, then track progress in Incomplete and Completed.
    </OnboardingDialog>
  );
}
