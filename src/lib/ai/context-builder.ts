import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PREVIOUS_SUMMARY_LIMIT,
  AI_RECENT_MESSAGE_LIMIT,
} from "@/lib/config";
import { conversationSummarySchema } from "@/lib/schemas";
import {
  DEFAULT_AI_PRIVACY_SETTINGS,
  type AIPrivacySettings,
} from "@/lib/privacy";

export type ContextMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type CompletedContextItem = {
  type: "goal" | "task";
  title: string;
  completedAt: string;
  associatedGoal?: string;
  description?: string;
};

export type ContextSource = {
  getBusinessSnapshot(): Promise<Record<string, unknown>>;
  getPrimaryGoal(): Promise<{
    id: string;
    title: string;
    description: string | null;
    target_date: string | null;
    status: "incomplete" | "completed";
    completed_at: string | null;
  } | null>;
  getActiveTasks(goalId?: string): Promise<
    Array<{
      id: string;
      title: string;
      status: "todo" | "in_progress" | "completed";
      priority: "na" | "low" | "medium" | "high";
      due_date: string | null;
      goal_id: string | null;
    }>
  >;
  getCurrentConversationMemory(
    conversationId: string,
    recentLimit: number,
  ): Promise<{
    summary: Record<string, unknown> | null;
    messages: ContextMessage[];
  }>;
  getPreviousConversationSummaries(
    conversationId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      title: string;
      updated_at: string;
      summary: Record<string, unknown>;
    }>
  >;
  getRecentCompletedItems(limit: number): Promise<CompletedContextItem[]>;
};

export type BuiltAIContext = {
  instructionsContext: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  diagnostics: {
    recentMessageCount: number;
    previousSummaryCount: number;
    activeTaskCount: number;
    recentCompletedCount: number;
    hasCurrentSummary: boolean;
  };
};

export async function buildAIContext({
  source,
  conversationId,
  recentMessageLimit = AI_RECENT_MESSAGE_LIMIT,
  previousSummaryLimit = AI_PREVIOUS_SUMMARY_LIMIT,
  privacySettings = DEFAULT_AI_PRIVACY_SETTINGS,
}: {
  source: ContextSource;
  conversationId: string;
  recentMessageLimit?: number;
  previousSummaryLimit?: number;
  privacySettings?: AIPrivacySettings;
}): Promise<BuiltAIContext> {
  const [snapshot, primaryGoal, memory, previousSummaries, recentCompleted] =
    await Promise.all([
      privacySettings.workspaceContextEnabled
        ? source.getBusinessSnapshot()
        : Promise.resolve({}),
      privacySettings.workspaceContextEnabled
        ? source.getPrimaryGoal()
        : Promise.resolve(null),
      source.getCurrentConversationMemory(conversationId, recentMessageLimit),
      privacySettings.crossConversationEnabled
        ? source.getPreviousConversationSummaries(
            conversationId,
            previousSummaryLimit,
          )
        : Promise.resolve([]),
      privacySettings.workspaceContextEnabled
        ? source.getRecentCompletedItems(10)
        : Promise.resolve([]),
    ]);
  const activeTasks = privacySettings.workspaceContextEnabled
    ? await source.getActiveTasks(primaryGoal?.id)
    : [];
  const currentSummary = parseSummary(memory.summary);
  const sections = [
    privacySettings.workspaceContextEnabled
      ? `Untrusted compact business snapshot:\n${JSON.stringify(snapshot)}`
      : "Business profile, goals, and task context: disabled by the workspace privacy setting.",
    primaryGoal
      ? `Current primary goal (database record):\n${JSON.stringify(primaryGoal)}`
      : "Current primary goal: none explicitly selected.",
    activeTasks.length
      ? `Relevant active tasks with authoritative statuses:\n${JSON.stringify(activeTasks)}`
      : "Relevant active tasks: none.",
    recentCompleted.length
      ? `Most recent explicitly confirmed completed work (bounded to 10 items):\n${JSON.stringify(recentCompleted)}`
      : "Recently completed work: none.",
    currentSummary
      ? `Current conversation rolling summary (untrusted memory; preserve confirmation labels):\n${JSON.stringify(currentSummary)}`
      : "Current conversation rolling summary: none yet.",
    !privacySettings.crossConversationEnabled
      ? "Previous consultation memory: disabled by the workspace privacy setting."
      : previousSummaries.length
      ? `Recent previous conversation summaries (retrieve details before relying on ambiguity):\n${JSON.stringify(previousSummaries)}`
      : "Recent previous conversation summaries: none.",
  ];
  return {
    instructionsContext: sections.join("\n\n"),
    messages: memory.messages.map(({ role, content }) => ({ role, content })),
    diagnostics: {
      recentMessageCount: memory.messages.length,
      previousSummaryCount: previousSummaries.length,
      activeTaskCount: activeTasks.length,
      recentCompletedCount: recentCompleted.length,
      hasCurrentSummary: Boolean(currentSummary),
    },
  };
}

export function createSupabaseContextSource({
  supabase,
  businessId,
}: {
  supabase: SupabaseClient;
  businessId: string;
}): ContextSource {
  return {
    async getBusinessSnapshot() {
      const { data, error } = await supabase
        .from("businesses")
        .select("business_snapshot,name")
        .eq("id", businessId)
        .single();
      if (error || !data) throw new Error("BUSINESS_CONTEXT_UNAVAILABLE");
      const snapshot = isRecord(data.business_snapshot)
        ? data.business_snapshot
        : {};
      return Object.keys(snapshot).length
        ? snapshot
        : { identity: { name: data.name } };
    },
    async getPrimaryGoal() {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("primary_goal_id")
        .eq("id", businessId)
        .single();
      if (businessError) throw new Error("BUSINESS_CONTEXT_UNAVAILABLE");
      if (!business?.primary_goal_id) return null;
      const { data, error } = await supabase
        .from("goals")
        .select("id,title,description,target_date,status,completed_at")
        .eq("id", business.primary_goal_id)
        .eq("business_id", businessId)
        .eq("status", "incomplete")
        .maybeSingle();
      if (error) throw new Error("GOAL_CONTEXT_UNAVAILABLE");
      return data;
    },
    async getActiveTasks(goalId) {
      let query = supabase
        .from("tasks")
        .select("id,title,status,priority,due_date,goal_id")
        .eq("business_id", businessId)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8);
      if (goalId) query = query.eq("goal_id", goalId);
      const { data, error } = await query;
      if (error) throw new Error("TASK_CONTEXT_UNAVAILABLE");
      return (data || []) as Awaited<
        ReturnType<ContextSource["getActiveTasks"]>
      >;
    },
    async getCurrentConversationMemory(conversationId, recentLimit) {
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("summary,summarized_message_count")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .single();
      if (conversationError || !conversation)
        throw new Error("CONVERSATION_CONTEXT_UNAVAILABLE");
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(recentLimit);
      if (messagesError) throw new Error("CONVERSATION_CONTEXT_UNAVAILABLE");
      return {
        summary: isRecord(conversation.summary) ? conversation.summary : null,
        messages: ((messages || []) as ContextMessage[]).reverse(),
      };
    },
    async getPreviousConversationSummaries(conversationId, limit) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,title,updated_at,summary")
        .eq("business_id", businessId)
        .neq("id", conversationId)
        .not("summary_updated_at", "is", null)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error("CONVERSATION_SUMMARIES_UNAVAILABLE");
      return (data || []).flatMap((item) => {
        const summary = parseSummary(item.summary);
        return summary ? [{ ...item, summary }] : [];
      });
    },
    async getRecentCompletedItems(limit) {
      const [
        { data: tasks, error: taskError },
        { data: goals, error: goalError },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("title,description,completed_at,goal_id,goals(title)")
          .eq("business_id", businessId)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(limit),
        supabase
          .from("goals")
          .select("title,description,completed_at")
          .eq("business_id", businessId)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(limit),
      ]);
      if (taskError || goalError)
        throw new Error("COMPLETED_CONTEXT_UNAVAILABLE");
      return selectRecentCompletedItems(
        [
          ...(tasks || []).map((task) => ({
            type: "task" as const,
            title: task.title,
            completedAt: task.completed_at as string,
            associatedGoal: relatedGoalTitle(task.goals),
            description: compactDescription(task.description),
          })),
          ...(goals || []).map((goal) => ({
            type: "goal" as const,
            title: goal.title,
            completedAt: goal.completed_at as string,
            description: compactDescription(goal.description),
          })),
        ],
        limit,
      );
    },
  };
}

export function selectRecentCompletedItems(
  items: CompletedContextItem[],
  limit = 10,
) {
  return [...items]
    .filter((item) => Boolean(item.completedAt))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, Math.min(10, Math.max(0, limit)))
    .map(
      (item) =>
        Object.fromEntries(
          Object.entries(item).filter(([, value]) => Boolean(value)),
        ) as CompletedContextItem,
    );
}

function relatedGoalTitle(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return isRecord(first) && typeof first.title === "string"
      ? first.title
      : undefined;
  }
  return isRecord(value) && typeof value.title === "string"
    ? value.title
    : undefined;
}

function compactDescription(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 180)
    : undefined;
}

function parseSummary(value: unknown) {
  if (!isRecord(value)) return null;
  const result = conversationSummarySchema.safeParse(value);
  if (!result.success) return null;
  return Object.values(result.data).some((items) => items.length)
    ? result.data
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
