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
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PRODUCT_NAME } from "@/lib/config";
import type { ConversationSummary } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { clearCachedChatSession } from "@/lib/chat-session-store";
import { FirstTimeOnboarding } from "@/components/first-time-onboarding";

const nav = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/tasks", label: "Goals & Tasks", icon: CheckSquare2 },
  { href: "/app/profile", label: "Business Profile", icon: UserRound },
];
export function AppShell({
  children,
  user,
  initialConversations,
  demoMode = false,
  demoUsesRealAi = false,
  showFirstTimeOnboarding = false,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl?: string | null };
  initialConversations: ConversationSummary[];
  demoMode?: boolean;
  demoUsesRealAi?: boolean;
  showFirstTimeOnboarding?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              path === href
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
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
        <main>{children}</main>
      </div>
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
      <FirstTimeOnboarding show={showFirstTimeOnboarding} />
    </div>
  );
}
