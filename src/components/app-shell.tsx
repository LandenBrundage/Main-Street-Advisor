"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Home,
  Menu,
  UserRound,
  CheckSquare2,
  LogOut,
  Settings,
  X,
  MessageSquare,
  Trash2,
  LockKeyhole,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PRODUCT_NAME } from "@/lib/config";
import type { ConversationSummary } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { clearCachedChatSession } from "@/lib/chat-session-store";
import { FirstTimeOnboarding } from "@/components/first-time-onboarding";
import {
  WorkspaceOnboardingProvider,
  useWorkspaceOnboarding,
} from "@/components/workspace-onboarding";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { OnboardingSpotlight } from "@/components/onboarding-spotlight";
import type { RequiredProfileField } from "@/lib/profile";

const nav = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/tasks", label: "Goals & Tasks", icon: CheckSquare2 },
  { href: "/app/profile", label: "Business Profile", icon: UserRound },
];
type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl?: string | null };
  initialConversations: ConversationSummary[];
  demoMode?: boolean;
  demoUsesRealAi?: boolean;
  showFirstTimeOnboarding?: boolean;
  initialMissingFields?: RequiredProfileField[];
  tourStorageKey?: string;
};

export function AppShell(props: AppShellProps) {
  return (
    <WorkspaceOnboardingProvider
      initialMissingFields={props.initialMissingFields || []}
      storageKey={
        props.tourStorageKey || `msa:workspace-tour:v1:${props.user.email}`
      }
      newUser={props.showFirstTimeOnboarding}
    >
      <AppShellContent {...props} />
    </WorkspaceOnboardingProvider>
  );
}

function AppShellContent({
  children,
  user,
  initialConversations,
  demoMode = false,
  demoUsesRealAi = false,
  showFirstTimeOnboarding = false,
}: AppShellProps) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onboarding = useWorkspaceOnboarding()!;
  const locked = onboarding.missingFields.length > 0;
  const [navigationReminder, setNavigationReminder] = useState(false);
  const allowedWhileLocked =
    path === "/app/profile" || path === "/app/settings";
  useEffect(() => {
    if (locked && !allowedWhileLocked) router.replace("/app/profile");
  }, [locked, allowedWhileLocked, router]);
  useEffect(() => {
    if (onboarding.tourStep !== "navigation") return;
    const revealMobileNavigation = () => {
      if (window.matchMedia("(max-width: 1023px)").matches) setOpen(true);
    };
    // Keep the real target visible when the viewport changes during this step.
    revealMobileNavigation();
    window.addEventListener("resize", revealMobileNavigation);
    return () => window.removeEventListener("resize", revealMobileNavigation);
  }, [onboarding.tourStep]);
  function remindAboutProfile() {
    if (onboarding.tourStep === "profile")
      onboarding.setTourStep("profile-ready");
    setNavigationReminder(true);
    setOpen(false);
  }
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationError, setConversationError] = useState("");
  const [deletingConversation, setDeletingConversation] = useState("");
  const [pendingConversation, setPendingConversation] =
    useState<ConversationSummary | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error);
      setConversations((await response.json()).conversations);
      setConversationError("");
    } catch {
      setConversationError("Recent consultations could not be refreshed.");
    }
  }, []);
  useEffect(() => {
    const listener = () => refreshConversations();
    window.addEventListener("conversations:changed", listener);
    return () => window.removeEventListener("conversations:changed", listener);
  }, [refreshConversations]);
  const selectedId = path.match(/^\/app\/conversations\/([^/]+)/)?.[1];
  const removeConversation = useCallback(
    async (id: string) => {
      if (deletingConversation) return;
      setDeletingConversation(id);
      setConversationError("");
      setDeleteError("");
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || "The consultation could not be deleted.",
          );
        }
        setConversations((current) => current.filter((item) => item.id !== id));
        clearCachedChatSession(id);
        setPendingConversation(null);
        if (selectedId === id) router.replace("/app");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The consultation could not be deleted.";
        setConversationError(message);
        setDeleteError(message);
      } finally {
        setDeletingConversation("");
      }
    },
    [deletingConversation, router, selectedId],
  );
  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 font-semibold">
        <Link
          href="/"
          aria-label={`${PRODUCT_NAME} home`}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2"
        >
          <BrandLogo className="w-14" />
          <span className="leading-tight">{PRODUCT_NAME}</span>
        </Link>
        <button
          className="ml-auto p-2 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>
      {demoMode && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">Fictional customer workspace</p>
          <p className="mt-1 leading-5">
            {demoUsesRealAi
              ? "Real AI is active. Messages use your OpenAI API credits."
              : "Offline AI is active. Replies are scripted and use no API credits."}{" "}
            Changes reset when this demo server restarts.
          </p>
        </div>
      )}
      <nav aria-label="Main navigation" className="space-y-1 px-3 pt-4">
        {nav.map(({ href, label, icon: Icon }) =>
          locked && href !== "/app/profile" ? (
            <button
              key={href}
              type="button"
              aria-disabled="true"
              onClick={remindAboutProfile}
              className="flex w-full items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-slate-400"
            >
              <Icon className="size-4" />
              {label}
              <LockKeyhole className="ml-auto size-3.5" />
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              data-tour-target={href === "/app/tasks" ? "goals" : undefined}
              onClick={() => {
                setOpen(false);
                if (
                  href === "/app/tasks" &&
                  onboarding.tourStep === "navigation"
                )
                  onboarding.setTourStep("goals");
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                path === href
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                href === "/app/tasks" &&
                  onboarding.tourStep === "navigation" &&
                  "ring-2 ring-blue-400 ring-offset-2",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ),
        )}
      </nav>
      <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent consultations
        </p>
        {conversationError && (
          <p className="px-2 text-xs text-red-700">{conversationError}</p>
        )}
        {conversations.length ? (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center rounded-lg text-sm",
                  selectedId === conversation.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {locked ? (
                  <button
                    type="button"
                    aria-disabled="true"
                    onClick={remindAboutProfile}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-slate-400"
                  >
                    <MessageSquare className="size-3.5 shrink-0" />
                    <span className="truncate">{conversation.title}</span>
                    <LockKeyhole className="size-3.5 shrink-0" />
                  </button>
                ) : (
                  <Link
                    href={`/app/conversations/${conversation.id}`}
                    onClick={() => setOpen(false)}
                    aria-current={
                      selectedId === conversation.id ? "page" : undefined
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2"
                  >
                    <MessageSquare className="size-3.5 shrink-0" />
                    <span className="truncate">{conversation.title}</span>
                  </Link>
                )}
                <button
                  className="mr-1 rounded p-1.5 text-slate-400 opacity-70 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete consultation: ${conversation.title}`}
                  disabled={Boolean(deletingConversation)}
                  onClick={() => {
                    setDeleteError("");
                    setPendingConversation(conversation);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm leading-5 text-slate-400">
            Your saved consultations will appear here.
          </p>
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <nav
          aria-label="Legal documents"
          className="mb-1 flex items-center gap-3 px-2 text-[11px] text-slate-400"
        >
          <Link
            href="/privacy"
            onClick={() => setOpen(false)}
            className="hover:text-blue-700 hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            onClick={() => setOpen(false)}
            className="hover:text-blue-700 hover:underline"
          >
            Tester Terms
          </Link>
        </nav>
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 bg-cover bg-center text-xs font-semibold text-blue-800"
            style={
              user.avatarUrl
                ? { backgroundImage: `url(${user.avatarUrl})` }
                : undefined
            }
          >
            {!user.avatarUrl && initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Account settings"
          >
            <Settings className="size-4" />
          </Link>
          <button
            onClick={async () => {
              if (demoMode) {
                router.replace("/sign-in");
                return;
              }
              try {
                await createClient().auth.signOut();
              } finally {
                router.replace("/sign-in");
              }
            }}
            className="p-2 text-slate-500 hover:text-red-700"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200 lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="relative h-full w-[min(88vw,300px)] shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            className="p-2"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <BrandLogo className="ml-2 w-12" />
          <span className="ml-1 whitespace-nowrap text-sm font-semibold">
            {PRODUCT_NAME}
          </span>
        </header>
        <main>
          {locked && !allowedWhileLocked ? (
            <p className="p-6 text-sm text-slate-500">
              Opening your Business Profile…
            </p>
          ) : (
            children
          )}
        </main>
      </div>
      <OnboardingDialog
        open={locked && navigationReminder}
        title="Finish your business profile"
        eyebrow="Business Profile"
        nextLabel="Go to required fields"
        onClose={() => setNavigationReminder(false)}
        onNext={() => {
          setNavigationReminder(false);
          const first = onboarding.missingFields[0];
          if (first) onboarding.requestField(first);
          if (path !== "/app/profile") router.push("/app/profile");
        }}
      >
        Complete the fields marked Required to unlock your advisor. Everything
        marked Optional can wait. We’ll take you to the next required field.
      </OnboardingDialog>
      <OnboardingSpotlight
        open={
          onboarding.tourStep === "navigation" &&
          !locked &&
          path !== "/app/tasks"
        }
        title="Find your action plan"
        targetSelector='[data-tour-target="goals"]'
        eyebrow="Your workspace · Step 3 of 3"
        nextLabel="Open Goals & Tasks"
        onClose={() => onboarding.setTourStep("done")}
        onNext={() => {
          onboarding.setTourStep("goals");
          setOpen(false);
          router.push("/app/tasks");
        }}
      >
        Click the highlighted Goals &amp; Tasks tab to see your goals and the
        actions that move them forward. You can also open it using the button
        below.
      </OnboardingSpotlight>
      <ConfirmDialog
        open={Boolean(pendingConversation)}
        title="Delete consultation?"
        description={`“${pendingConversation?.title || "This consultation"}” and all of its messages will be permanently deleted. Approved goals and tasks will remain.`}
        confirmLabel="Delete consultation"
        busy={Boolean(deletingConversation)}
        error={deleteError}
        onCancel={() => {
          if (deletingConversation) return;
          setPendingConversation(null);
          setDeleteError("");
        }}
        onConfirm={() => {
          if (pendingConversation) removeConversation(pendingConversation.id);
        }}
      />
      <FirstTimeOnboarding
        show={showFirstTimeOnboarding}
        onDismiss={onboarding.dismissWelcome}
      />
    </div>
  );
}
