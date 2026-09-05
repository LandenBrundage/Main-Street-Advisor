"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  ListPlus,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  WandSparkles,
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

type GuidedPromptDraft = {
  goalOrChallenge: string;
  background: string;
  tried: string;
  constraints: string;
  desiredOutcome: string;
};

const emptyGuidedPrompt: GuidedPromptDraft = {
  goalOrChallenge: "",
  background: "",
  tried: "",
  constraints: "",
  desiredOutcome: "",
};

export function buildGuidedPrompt(draft: GuidedPromptDraft) {
  const sections = [
    ["My goal or challenge", draft.goalOrChallenge],
    ["Relevant background", draft.background],
    ["What I have already tried", draft.tried],
    ["Constraints or concerns", draft.constraints],
    ["Desired outcome", draft.desiredOutcome],
  ]
    .filter(([, answer]) => answer.trim())
    .map(([heading, answer]) => `${heading}:\n${answer.trim()}`);
  return `${sections.join(
    "\n\n",
  )}\n\nPlease give me practical recommendations and explain the best next steps.`;
}

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
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidedDraft, setGuidedDraft] =
    useState<GuidedPromptDraft>(emptyGuidedPrompt);
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
  const [lastAttemptSourceMessageId, setLastAttemptSourceMessageId] = useState<
    string | undefined
  >();
  const [creatingPlanFor, setCreatingPlanFor] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
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
  async function send(
    text = value,
    options: { taskPlanSourceMessageId?: string } = {},
  ) {
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
    setGuidedOpen(false);
    setBusy(true);
    setError("");
    setLastAttempt(clean);
    setLastAttemptSourceMessageId(options.taskPlanSourceMessageId);
    if (options.taskPlanSourceMessageId)
      setCreatingPlanFor(options.taskPlanSourceMessageId);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: clean,
          ...(options.taskPlanSourceMessageId
            ? { taskPlanSourceMessageId: options.taskPlanSourceMessageId }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (
          ["MESSAGE_BLOCKED", "SENSITIVE_DATA_DETECTED"].includes(data.code)
        ) {
          const retained = messagesRef.current.filter(
            (message) => message.id !== optimistic.id,
          );
          messagesRef.current = retained;
          setMessages(retained);
          setValue(clean);
          setLastAttempt("");
        }
        throw new Error(
          data.error || "The consultant is temporarily unavailable.",
        );
      }
      const currentMessages = options.taskPlanSourceMessageId
        ? messagesRef.current.map((message) =>
            message.id === options.taskPlanSourceMessageId && data.proposal
              ? {
                  ...message,
                  metadata: {
                    ...(message.metadata || {}),
                    proposal_id: data.proposal.id,
                    task_plan_status: "proposed",
                  },
                }
              : message,
          )
        : messagesRef.current;
      const nextMessages = [...currentMessages, data.message];
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
      setCreatingPlanFor("");
    }
  }

  function markProposalHandled(
    proposalId: string,
    status: "approved" | "cancelled",
  ) {
    const nextMessages = messagesRef.current.map((message) =>
      message.metadata?.proposal_id === proposalId
        ? {
            ...message,
            metadata: { ...message.metadata, task_plan_status: status },
          }
        : message,
    );
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setProposal(null);
    if (conversationId)
      cacheChatSession(conversationId, {
        messages: nextMessages,
        proposal: null,
        completionProposal,
      });
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
                <>
                  <ChatMarkdown content={message.content} />
                  {canCreatePlanFromMessage(message) && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={busy}
                      onClick={() =>
                        send(
                          "Create a goal and practical task list from your previous recommendation for my review.",
                          { taskPlanSourceMessageId: message.id },
                        )
                      }
                    >
                      {creatingPlanFor === message.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ListPlus className="size-4" />
                      )}
                      {creatingPlanFor === message.id
                        ? "Preparing plan…"
                        : "Create goal & tasks"}
                    </button>
                  )}
                </>
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
              key={proposal.id}
              proposal={proposal}
              onCancel={(proposalId) =>
                markProposalHandled(proposalId, "cancelled")
              }
              onSaved={(result) => {
                setSaved(result);
                markProposalHandled(proposal.id, "approved");
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
          {guidedOpen ? (
            <GuidedPromptBuilder
              draft={guidedDraft}
              onChange={setGuidedDraft}
              onClose={() => setGuidedOpen(false)}
              onBuild={() => {
                const prompt = buildGuidedPrompt(guidedDraft);
                setValue((current) =>
                  current
                    ? `${current}${current.endsWith("\n") ? "\n" : "\n\n"}${prompt}`
                    : prompt,
                );
                setGuidedOpen(false);
                setTimeout(() => composerInput.current?.focus(), 0);
              }}
            />
          ) : (
            <textarea
              ref={composerInput}
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
          )}
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-slate-400">
              {guidedOpen
                ? "Add what you know—you can edit the prompt before sending"
                : "Enter to send · Shift+Enter for a new line"}
            </span>
            <div className="ml-3 flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setGuidedOpen((current) => !current)}
                disabled={busy}
                className="grid size-9 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                aria-label={
                  guidedOpen ? "Close guided prompt" : "Build a guided prompt"
                }
                aria-controls="guided-prompt-builder"
                aria-expanded={guidedOpen}
                title="Build a guided prompt"
              >
                <WandSparkles className="size-4" />
              </button>
              <button
                onClick={() => send()}
                disabled={!value.trim() || busy || guidedOpen}
                className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white disabled:bg-slate-200"
                aria-label="Send message"
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
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
                onClick={() =>
                  send(lastAttempt, {
                    taskPlanSourceMessageId: lastAttemptSourceMessageId,
                  })
                }
                className="flex shrink-0 items-center gap-1 font-semibold"
              >
                <RotateCcw className="size-3" />
                Retry
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Your message and enabled workspace context are processed by OpenAI. AI
          can make mistakes; confirm high-stakes decisions with a qualified
          professional and avoid passwords or government/payment identifiers.{" "}
          <Link
            href="/privacy#ai-and-documents"
            className="underline hover:text-slate-600"
          >
            AI data details
          </Link>
          {" · "}
          <Link href="/app/settings" className="underline hover:text-slate-600">
            Manage AI privacy
          </Link>
        </p>
      </div>
    </div>
  );
}

function GuidedPromptBuilder({
  draft,
  onChange,
  onClose,
  onBuild,
}: {
  draft: GuidedPromptDraft;
  onChange: (draft: GuidedPromptDraft) => void;
  onClose: () => void;
  onBuild: () => void;
}) {
  function setField(field: keyof GuidedPromptDraft, value: string) {
    onChange({ ...draft, [field]: value });
  }

  return (
    <section
      id="guided-prompt-builder"
      aria-labelledby="guided-prompt-title"
      className="max-h-[62vh] overflow-y-auto px-2 pb-3 pt-1"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-100 bg-white px-1 py-3">
        <div>
          <h2
            id="guided-prompt-title"
            className="text-sm font-semibold text-slate-950"
          >
            Build a clearer business question
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Share only what is useful. Nothing sends until you review it.
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-1 py-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">
            Goal or challenge <span className="text-red-500">•</span>
          </span>
          <textarea
            className="field"
            rows={2}
            required
            aria-required="true"
            autoFocus
            maxLength={2000}
            value={draft.goalOrChallenge}
            placeholder="What would you like to improve, decide, or solve?"
            onChange={(event) =>
              setField("goalOrChallenge", event.target.value)
            }
          />
        </label>
        <GuidedField
          label="Relevant background"
          value={draft.background}
          placeholder="What should the advisor understand about the situation?"
          onChange={(value) => setField("background", value)}
        />
        <GuidedField
          label="What you have already tried"
          value={draft.tried}
          placeholder="Include what happened, if anything."
          onChange={(value) => setField("tried", value)}
        />
        <GuidedField
          label="Constraints or concerns"
          value={draft.constraints}
          placeholder="Budget, time, staffing, risks, or approaches to avoid."
          onChange={(value) => setField("constraints", value)}
        />
        <GuidedField
          label="Desired outcome"
          value={draft.desiredOutcome}
          placeholder="What would a useful result look like?"
          onChange={(value) => setField("desiredOutcome", value)}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-1 pt-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!draft.goalOrChallenge.trim()}
          onClick={onBuild}
        >
          <WandSparkles className="size-4" /> Build editable prompt
        </button>
      </div>
    </section>
  );
}

function GuidedField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea
        className="field"
        rows={3}
        maxLength={2000}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
  onCancel: (proposalId: string) => void;
  onSaved: (result: { taskCount: number; goalId?: string }) => void;
}) {
  const [draft, setDraft] = useState<TaskPlan>(() => editablePlan(proposal));
  const [busyAction, setBusyAction] = useState<"approve" | "cancel" | "">("");
  const [error, setError] = useState("");

  function setGoal(field: keyof TaskPlan["goal"], value: string) {
    setDraft((current) => ({
      ...current,
      goal: { ...current.goal, [field]: value || undefined },
    }));
  }

  function setTask(index: number, patch: Partial<TaskPlan["tasks"][number]>) {
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task,
      ),
    }));
  }

  async function approve() {
    if (busyAction) return;
    const plan = editablePlan(draft);
    if (
      !plan.goal.title.trim() ||
      plan.tasks.some((task) => !task.title.trim())
    ) {
      setError("Add a title for the goal and each task before saving.");
      return;
    }
    setBusyAction("approve");
    setError("");
    try {
      const updateResponse = await fetch(`/api/task-plans/${proposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(plan),
      });
      const updateData = await updateResponse.json();
      if (!updateResponse.ok)
        throw new Error(
          updateData.error || "The task proposal could not be updated.",
        );
      const response = await fetch(`/api/task-plans/${proposal.id}/approve`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The task proposal could not be saved.");
      window.dispatchEvent(new Event("tasks:changed"));
      onSaved({ taskCount: data.tasks.length, goalId: data.goal?.id });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The task proposal could not be saved.",
      );
      setBusyAction("");
    }
  }

  async function cancel() {
    if (busyAction) return;
    setBusyAction("cancel");
    setError("");
    try {
      const response = await fetch(`/api/task-plans/${proposal.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The task proposal could not be cancelled.",
        );
      onCancel(proposal.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The task proposal could not be cancelled.",
      );
      setBusyAction("");
    }
  }

  return (
    <section
      className="card border-blue-200 p-5"
      aria-labelledby="task-plan-review-title"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        Proposed action plan
      </p>
      <h2 id="task-plan-review-title" className="mt-1 text-lg font-semibold">
        Review goal and tasks
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Edit anything below. Nothing is added until you confirm.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Goal title</span>
          <input
            className="field"
            required
            maxLength={160}
            value={draft.goal.title}
            onChange={(event) => setGoal("title", event.target.value)}
          />
        </label>
        <label>
          <span className="label">Goal description</span>
          <textarea
            className="field"
            rows={3}
            maxLength={4000}
            value={draft.goal.description || ""}
            onChange={(event) => setGoal("description", event.target.value)}
          />
        </label>
        <label>
          <span className="label">Target date</span>
          <input
            className="field"
            type="date"
            value={draft.goal.targetDate || ""}
            onChange={(event) => setGoal("targetDate", event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Tasks</h3>
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          disabled={Boolean(busyAction) || draft.tasks.length >= 30}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              tasks: [
                ...current.tasks,
                {
                  title: "",
                  description: undefined,
                  dueDate: undefined,
                  priority: "na",
                  order: current.tasks.length,
                },
              ],
            }))
          }
        >
          <Plus className="size-4" /> Add task
        </button>
      </div>
      <ol className="mt-3 space-y-3">
        {draft.tasks.map((task, index) => (
          <li
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-blue-700">
                Task {index + 1}
              </p>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove task ${index + 1}`}
                disabled={Boolean(busyAction) || draft.tasks.length === 1}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    tasks: current.tasks
                      .filter((_, taskIndex) => taskIndex !== index)
                      .map((item, taskIndex) => ({
                        ...item,
                        order: taskIndex,
                      })),
                  }))
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Task title</span>
                <input
                  className="field"
                  required
                  maxLength={160}
                  value={task.title}
                  onChange={(event) =>
                    setTask(index, { title: event.target.value })
                  }
                />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Task description</span>
                <textarea
                  className="field"
                  rows={2}
                  maxLength={4000}
                  value={task.description || ""}
                  onChange={(event) =>
                    setTask(index, {
                      description: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <label>
                <span className="label">Due date</span>
                <input
                  className="field"
                  type="date"
                  value={task.dueDate || ""}
                  onChange={(event) =>
                    setTask(index, {
                      dueDate: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <label>
                <span className="label">Priority</span>
                <select
                  className="field"
                  value={task.priority}
                  onChange={(event) =>
                    setTask(index, {
                      priority: event.target
                        .value as TaskPlan["tasks"][number]["priority"],
                    })
                  }
                >
                  <option value="na">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button
          onClick={approve}
          disabled={Boolean(busyAction)}
          className="btn-primary"
        >
          {busyAction === "approve" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Save goal & tasks
        </button>
        <button
          onClick={cancel}
          disabled={Boolean(busyAction)}
          className="btn-secondary"
        >
          {busyAction === "cancel" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Cancel
        </button>
      </div>
    </section>
  );
}

function editablePlan(plan: TaskPlan): TaskPlan {
  return {
    goal: {
      title: plan.goal.title,
      description: plan.goal.description || undefined,
      targetDate: plan.goal.targetDate || undefined,
    },
    tasks: [...plan.tasks]
      .sort((left, right) => left.order - right.order)
      .map((task, order) => ({
        title: task.title,
        description: task.description || undefined,
        dueDate: task.dueDate || undefined,
        priority: task.priority,
        order,
      })),
  };
}

function canCreatePlanFromMessage(message: ChatMessage) {
  return (
    message.role === "assistant" &&
    message.metadata?.can_create_task_plan === true &&
    (message.metadata.task_plan_status === undefined ||
      message.metadata.task_plan_status === "available")
  );
}
