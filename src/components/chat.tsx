"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { ChatMarkdown } from "@/components/chat-markdown";
import {
  cacheChatSession,
  getCachedChatSession,
  type CompletionProposalView,
} from "@/lib/chat-session-store";
import type { ChatMessage } from "@/lib/domain";
import type { TaskPlan } from "@/lib/schemas";

const suggestions = [
  "Help me increase weekday sales.",
  "Create a plan to reduce operating costs.",
  "How can I improve customer retention?",
  "Help me prioritize my business goals.",
];
export function Chat({
  firstName = "there",
  businessName = "your business",
  conversationId: initialConversationId,
}: {
  firstName?: string;
  businessName?: string;
  conversationId?: string;
}) {
  const router = useRouter();
  const [cached] = useState(() => getCachedChatSession(initialConversationId));
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    cached?.messages || [],
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(
    Boolean(initialConversationId && !cached),
  );
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<(TaskPlan & { id: string }) | null>(
    cached?.proposal || null,
  );
  const [completionProposal, setCompletionProposal] =
    useState<CompletionProposalView | null>(cached?.completionProposal || null);
  const [saved, setSaved] = useState<{
    taskCount: number;
    goalId?: string;
  } | null>(null);
  const [savedTaskCompletion, setSavedTaskCompletion] = useState("");
  const [lastAttempt, setLastAttempt] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, proposal]);
  useEffect(() => {
    if (!initialConversationId) return;
    const controller = new AbortController();
    fetch(`/api/conversations/${initialConversationId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error);
        return response.json();
      })
      .then((data) => {
        setMessages(data.messages);
        setConversationId(data.conversation.id);
        setProposal(data.proposal || null);
        setCompletionProposal(data.completionProposal || null);
        cacheChatSession(data.conversation.id, {
          messages: data.messages,
          proposal: data.proposal || null,
          completionProposal: data.completionProposal || null,
        });
      })
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError(reason.message || "The consultation could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [initialConversationId]);
  async function send(text = value) {
    const clean = text.trim();
    if (!clean || busy) return;
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
      created_at: new Date().toISOString(),
    };
    const optimisticMessages = [...messagesRef.current, optimistic];
    messagesRef.current = optimisticMessages;
    setMessages(optimisticMessages);
    setValue("");
    setBusy(true);
    setError("");
    setLastAttempt(clean);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message: clean }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The consultant is temporarily unavailable.",
        );
      const nextMessages = [...messagesRef.current, data.message];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      const nextProposal = data.proposal || proposal;
      const nextCompletionProposal =
        data.completionProposal || completionProposal;
      if (data.proposal) setProposal(data.proposal);
      if (data.completionProposal)
        setCompletionProposal(data.completionProposal);
      cacheChatSession(data.conversationId, {
        messages: nextMessages,
        proposal: nextProposal,
        completionProposal: nextCompletionProposal,
      });
      if (!conversationId) {
        setConversationId(data.conversationId);
        router.replace(`/app/conversations/${data.conversationId}`);
      }
      window.dispatchEvent(new Event("conversations:changed"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The response was interrupted.",
      );
    } finally {
      setBusy(false);
    }
  }
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-4xl flex-col px-4 py-8 sm:px-7 lg:min-h-screen lg:py-12">
      {loading ? (
        <div className="my-auto flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Loading consultation…
        </div>
      ) : !messages.length ? (
        <div className="my-auto">
          <div className="mb-10 text-center">
            <span className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="size-5" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 text-lg text-slate-500">
              How can I help {businessName} today?
            </p>
          </div>
          <div className="mb-5 grid gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50/40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 pb-8" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-[15px] leading-7 text-white sm:max-w-[78%]"
                  : "max-w-3xl text-[15px] leading-7 text-slate-700"
              }
            >
              {message.role === "assistant" ? (
                <ChatMarkdown content={message.content} />
              ) : (
                <span className="whitespace-pre-wrap">{message.content}</span>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Thinking through your business…
            </div>
          )}
          {proposal && (
            <Proposal
              proposal={proposal}
              onCancel={() => setProposal(null)}
              onSaved={(result) => {
                setSaved(result);
                setProposal(null);
              }}
            />
          )}{" "}
          {completionProposal && (
            <CompletionProposal
              proposal={completionProposal}
              onCancel={() => setCompletionProposal(null)}
              onApproved={(taskTitle) => {
                setCompletionProposal(null);
                setSavedTaskCompletion(taskTitle);
              }}
            />
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="size-4" />
              {saved.taskCount} {saved.taskCount === 1 ? "task" : "tasks"} added
              successfully.{" "}
              <Link
                href={
                  saved.goalId
                    ? `/app/tasks?goal=${saved.goalId}`
                    : "/app/tasks"
                }
                className="font-semibold underline"
              >
                View tasks
              </Link>
            </div>
          )}
          {savedTaskCompletion && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="size-4" />“{savedTaskCompletion}” was
              marked complete after your confirmation.
              <Link href="/app/tasks" className="font-semibold underline">
                View tasks
              </Link>
            </div>
          )}
          <div ref={end} />
        </div>
      )}
      <div className="sticky bottom-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60">
          <textarea
            aria-label="Message your business consultant"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={3}
            placeholder="Describe a challenge, goal, or decision…"
            className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-slate-400">
              Enter to send · Shift+Enter for a new line
            </span>
            <button
              onClick={() => send()}
              disabled={!value.trim() || busy}
              className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white disabled:bg-slate-200"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <span>{error}</span>
            {lastAttempt && (
              <button
                onClick={() => send(lastAttempt)}
                className="flex shrink-0 items-center gap-1 font-semibold"
              >
                <RotateCcw className="size-3" />
                Retry
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          AI can make mistakes. Confirm high-stakes legal, tax, accounting, and
          financial decisions with a qualified professional.
        </p>
      </div>
    </div>
  );
}
function CompletionProposal({
  proposal,
  onCancel,
  onApproved,
}: {
  proposal: CompletionProposalView;
  onCancel: () => void;
  onApproved: (taskTitle: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/task-completions/${proposal.id}/approve`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The task could not be updated.");
      window.dispatchEvent(new Event("tasks:changed"));
      onApproved(data.task?.title || proposal.task.title);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The task could not be updated.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="card border-blue-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        Confirmation required
      </p>
      <h2 className="mt-1 text-lg font-semibold">Mark task complete?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {proposal.confirmationText}
      </p>
      <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-800">
        {proposal.task.title}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={approve} disabled={busy} className="btn-primary">
          {busy && <Loader2 className="size-4 animate-spin" />}
          Confirm completion
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-secondary">
          Keep task open
        </button>
      </div>
    </section>
  );
}
function Proposal({
  proposal,
  onCancel,
  onSaved,
}: {
  proposal: TaskPlan & { id: string };
  onCancel: () => void;
  onSaved: (result: { taskCount: number; goalId?: string }) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/task-plans/${proposal.id}/approve`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The task proposal could not be saved.");
      onSaved({ taskCount: data.tasks.length, goalId: data.goal?.id });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The task proposal could not be saved.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        Proposed action plan
      </p>
      <h2 className="mt-1 text-lg font-semibold">{proposal.goal.title}</h2>
      {proposal.goal.description && (
        <p className="mt-1 text-sm text-slate-500">
          {proposal.goal.description}
        </p>
      )}
      <ol className="mt-4 space-y-2">
        {[...proposal.tasks]
          .sort((a, b) => a.order - b.order)
          .map((task) => (
            <li
              key={`${task.order}-${task.title}`}
              className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm"
            >
              <span className="font-semibold text-blue-600">
                {task.order + 1}
              </span>
              <span>
                <b>{task.title}</b>
                {task.description && (
                  <span className="mt-1 block text-slate-500">
                    {task.description}
                  </span>
                )}
              </span>
            </li>
          ))}
      </ol>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={approve} disabled={busy} className="btn-primary">
          {busy && <Loader2 className="size-4 animate-spin" />}Add tasks
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-secondary">
          Cancel
        </button>
      </div>
    </section>
  );
}
