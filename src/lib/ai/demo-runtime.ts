import {
  selectRecentCompletedItems,
  type ContextSource,
} from "@/lib/ai/context-builder";
import {
  conversationDetailsArgs,
  idArgs,
  listGoalsArgs,
  listSummariesArgs,
  listTasksArgs,
  profileSectionSchema,
} from "@/lib/ai/retrieval-tools";
import { getDemoAIData, getDemoProfile } from "@/lib/demo-store";

export function createDemoContextSource(): ContextSource {
  return {
    async getBusinessSnapshot() {
      const { business, documents } = getDemoAIData();
      const snapshot = business.business_snapshot || {
        identity: { name: business.name },
      };
      const fictionalDocumentExtracts = documents
        .filter(
          (document) =>
            document.status === "ready" && Boolean(document.extracted_text),
        )
        .slice(0, 5)
        .map((document) => ({
          source: document.name,
          content: document.extracted_text?.slice(0, 800),
        }));
      return {
        ...snapshot,
        ...(fictionalDocumentExtracts.length
          ? { fictionalDocumentExtracts }
          : {}),
      };
    },
    async getPrimaryGoal() {
      const { business, goals } = getDemoAIData();
      return (
        goals.find(
          (goal) =>
            goal.id === business.primary_goal_id &&
            goal.status === "incomplete",
        ) || null
      );
    },
    async getActiveTasks(goalId) {
      const { tasks } = getDemoAIData();
      return tasks
        .filter(
          (task) =>
            task.status !== "completed" && (!goalId || task.goal_id === goalId),
        )
        .sort((left, right) =>
          (left.due_date || "9999-12-31").localeCompare(
            right.due_date || "9999-12-31",
          ),
        )
        .slice(0, 8)
        .map(({ id, title, status, priority, due_date, goal_id }) => ({
          id,
          title,
          status,
          priority,
          due_date,
          goal_id,
        }));
    },
    async getCurrentConversationMemory(conversationId, recentLimit) {
      const { conversations, messages } = getDemoAIData();
      const conversation = conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) throw new Error("CONVERSATION_CONTEXT_UNAVAILABLE");
      return {
        summary: conversation.summary,
        messages: messages
          .filter((message) => message.conversation_id === conversationId)
          .sort((left, right) =>
            left.created_at.localeCompare(right.created_at),
          )
          .slice(-recentLimit)
          .map(({ id, role, content, created_at }) => ({
            id,
            role,
            content,
            created_at,
          })),
      };
    },
    async getPreviousConversationSummaries(conversationId, limit) {
      const { conversations, messages } = getDemoAIData();
      return conversations
        .filter((conversation) => conversation.id !== conversationId)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .slice(0, limit)
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updated_at: conversation.updated_at,
          summary: conversation.summary_updated_at
            ? conversation.summary
            : null,
          ...(!conversation.summary_updated_at
            ? {
                recentMessages: messages
                  .filter(
                    (message) =>
                      message.conversation_id === conversation.id &&
                      (message.role === "user" ||
                        message.role === "assistant"),
                  )
                  .sort((left, right) =>
                    left.created_at.localeCompare(right.created_at),
                  )
                  .slice(-4)
                  .map(({ role, content }) => ({
                    role,
                    content: content.slice(0, 1_200),
                  })),
              }
            : {}),
        }))
        .filter(
          (conversation) =>
            conversation.summary || conversation.recentMessages?.length,
        );
    },
    async getRecentCompletedItems(limit) {
      const { goals, tasks } = getDemoAIData();
      const goalTitles = new Map(goals.map((goal) => [goal.id, goal.title]));
      return selectRecentCompletedItems(
        [
          ...goals
            .filter((goal) => goal.status === "completed" && goal.completed_at)
            .map((goal) => ({
              type: "goal" as const,
              title: goal.title,
              completedAt: goal.completed_at!,
              description: compactDescription(goal.description),
            })),
          ...tasks
            .filter((task) => task.status === "completed" && task.completed_at)
            .map((task) => ({
              type: "task" as const,
              title: task.title,
              completedAt: task.completed_at!,
              associatedGoal: task.goal_id
                ? goalTitles.get(task.goal_id)
                : undefined,
              description: compactDescription(task.description),
            })),
        ],
        limit,
      );
    },
  };
}

export function createDemoRetrievalExecutor({
  currentConversationId,
  recentCompletedCount = 0,
}: {
  currentConversationId: string;
  recentCompletedCount?: number;
}) {
  let remainingCompletedItems = Math.max(0, 10 - recentCompletedCount);
  return async function execute(name: string, rawArguments: string) {
    const raw = JSON.parse(rawArguments) as unknown;
    const data = getDemoAIData();
    switch (name) {
      case "get_business_profile_section": {
        const { section } = profileSectionSchema
          .transform((section) => ({ section }))
          .parse((raw as { section?: unknown } | null)?.section);
        return { section, data: getDemoProfile()[section] };
      }
      case "list_goals": {
        const { limit, status } = listGoalsArgs.parse(raw);
        const desiredStatus = status || "incomplete";
        const queryLimit =
          desiredStatus === "completed"
            ? Math.min(limit, remainingCompletedItems)
            : limit;
        if (queryLimit === 0) return [];
        const goals = data.goals
          .filter((goal) => goal.status === desiredStatus)
          .sort((left, right) =>
            desiredStatus === "completed"
              ? (right.completed_at || "").localeCompare(
                  left.completed_at || "",
                )
              : right.updated_at.localeCompare(left.updated_at),
          )
          .slice(0, queryLimit)
          .map((goal) => {
            const related = data.tasks.filter(
              (task) => task.goal_id === goal.id,
            );
            const completed = related.filter(
              (task) => task.status === "completed",
            ).length;
            return {
              ...goal,
              progress: {
                completed,
                total: related.length,
                percent: related.length
                  ? Math.round((completed / related.length) * 100)
                  : 0,
              },
            };
          });
        if (desiredStatus === "completed")
          remainingCompletedItems -= goals.length;
        return goals;
      }
      case "list_tasks": {
        const args = listTasksArgs.parse(raw);
        const queryLimit =
          args.status === "completed"
            ? Math.min(args.limit, remainingCompletedItems)
            : args.limit;
        if (queryLimit === 0) return [];
        const tasks = data.tasks
          .filter(
            (task) =>
              (!args.goalId || task.goal_id === args.goalId) &&
              (args.status
                ? task.status === args.status
                : task.status !== "completed") &&
              (!args.priority || task.priority === args.priority) &&
              (!args.dueBefore ||
                Boolean(task.due_date && task.due_date <= args.dueBefore)) &&
              (!args.dueAfter ||
                Boolean(task.due_date && task.due_date >= args.dueAfter)),
          )
          .sort((left, right) =>
            args.status === "completed"
              ? (right.completed_at || "").localeCompare(
                  left.completed_at || "",
                )
              : right.updated_at.localeCompare(left.updated_at),
          )
          .slice(0, queryLimit);
        if (args.status === "completed")
          remainingCompletedItems -= tasks.length;
        return tasks;
      }
      case "get_task": {
        const { id } = idArgs.parse(raw);
        const task = data.tasks.find((item) => item.id === id);
        if (!task) return { found: false };
        if (task.status === "completed") {
          if (remainingCompletedItems === 0)
            return {
              found: false,
              reason: "The completed-work context limit has been reached.",
            };
          remainingCompletedItems -= 1;
        }
        return task;
      }
      case "list_conversation_summaries": {
        const { limit } = listSummariesArgs.parse(raw);
        return data.conversations
          .filter(
            (conversation) =>
              conversation.id !== currentConversationId &&
              Boolean(conversation.summary),
          )
          .sort((left, right) =>
            right.updated_at.localeCompare(left.updated_at),
          )
          .slice(0, limit)
          .map(({ id, title, updated_at, summary }) => ({
            id,
            title,
            updated_at,
            summary,
          }));
      }
      case "get_conversation_details": {
        const args = conversationDetailsArgs.parse(raw);
        const conversation = data.conversations.find(
          (item) => item.id === args.id,
        );
        if (!conversation) return { found: false, messages: [] };
        return {
          conversation,
          messages: data.messages
            .filter((message) => message.conversation_id === args.id)
            .sort((left, right) =>
              left.created_at.localeCompare(right.created_at),
            )
            .slice(args.offset, args.offset + args.limit)
            .map(({ role, content, created_at }) => ({
              role,
              content,
              created_at,
            })),
          page: { offset: args.offset, limit: args.limit },
        };
      }
      default:
        throw new Error("UNAPPROVED_RETRIEVAL_TOOL");
    }
  };
}

function compactDescription(value: string | null) {
  return value?.trim() ? value.trim().slice(0, 180) : undefined;
}
