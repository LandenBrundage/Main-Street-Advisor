import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapStoredBusinessProfile } from "@/lib/profile";
import {
  conversationSummarySchema,
  goalStatusSchema,
  prioritySchema,
  statusSchema,
} from "@/lib/schemas";

export const profileSectionSchema = z.enum([
  "basics",
  "offerings",
  "customers",
  "performance",
  "operations",
  "goals",
  "advice",
  "legacyAdditionalInformation",
]);
export const listGoalsArgs = z.object({
  status: goalStatusSchema.nullable(),
  limit: z.number().int().min(1).max(30),
});
export const listTasksArgs = z.object({
  goalId: z.uuid().nullable(),
  status: statusSchema.nullable(),
  priority: prioritySchema.nullable(),
  dueBefore: z.iso.date().nullable(),
  dueAfter: z.iso.date().nullable(),
  limit: z.number().int().min(1).max(50),
});
export const idArgs = z.object({ id: z.uuid() });
export const listSummariesArgs = z.object({
  limit: z.number().int().min(1).max(10),
});
export const conversationDetailsArgs = z.object({
  id: z.uuid(),
  offset: z.number().int().min(0).max(5000),
  limit: z.number().int().min(1).max(50),
});

export const retrievalTools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "get_business_profile_section",
    description:
      "Retrieve one complete section of the current workspace's business profile when the compact snapshot is insufficient.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["section"],
      properties: {
        section: {
          type: "string",
          enum: profileSectionSchema.options,
        },
      },
    },
  },
  {
    type: "function",
    name: "list_goals",
    description:
      "List goals in the current workspace with task-derived progress. A null status means incomplete goals; completed results share the request's bounded recent-completion budget.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["status", "limit"],
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["incomplete", "completed", null],
        },
        limit: { type: "integer", minimum: 1, maximum: 30 },
      },
    },
  },
  {
    type: "function",
    name: "list_tasks",
    description:
      "List authoritative task records in the current workspace using optional filters. A null status means incomplete tasks; completed results share the request's bounded recent-completion budget.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "goalId",
        "status",
        "priority",
        "dueBefore",
        "dueAfter",
        "limit",
      ],
      properties: {
        goalId: { type: ["string", "null"], format: "uuid" },
        status: {
          type: ["string", "null"],
          enum: ["todo", "in_progress", "completed", null],
        },
        priority: {
          type: ["string", "null"],
          enum: ["na", "low", "medium", "high", null],
        },
        dueBefore: { type: ["string", "null"], format: "date" },
        dueAfter: { type: ["string", "null"], format: "date" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    type: "function",
    name: "get_task",
    description:
      "Retrieve one authoritative task from the current workspace by an ID returned by another approved tool.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
  {
    type: "function",
    name: "list_conversation_summaries",
    description:
      "Retrieve a few recent consultation summaries from the current workspace. Confirmation labels are authoritative and must be preserved.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["limit"],
      properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
    },
  },
  {
    type: "function",
    name: "get_conversation_details",
    description:
      "Retrieve a bounded page of messages plus the rolling summary for one consultation in the current workspace.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["id", "offset", "limit"],
      properties: {
        id: { type: "string", format: "uuid" },
        offset: { type: "integer", minimum: 0, maximum: 5000 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
];

export const RETRIEVAL_TOOL_NAMES = new Set(
  retrievalTools.flatMap((tool) =>
    tool.type === "function" ? [tool.name] : [],
  ),
);

export function createRetrievalExecutor({
  supabase,
  businessId,
  currentConversationId,
  recentCompletedCount = 0,
}: {
  supabase: SupabaseClient;
  businessId: string;
  currentConversationId: string;
  recentCompletedCount?: number;
}) {
  let remainingCompletedItems = Math.max(0, 10 - recentCompletedCount);
  return async function execute(name: string, rawArguments: string) {
    const raw = JSON.parse(rawArguments) as unknown;
    switch (name) {
      case "get_business_profile_section": {
        const { section } = z
          .object({ section: profileSectionSchema })
          .parse(raw);
        const { data: business, error } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", businessId)
          .single();
        if (error || !business) throw new Error("PROFILE_RETRIEVAL_FAILED");
        const mapped = mapStoredBusinessProfile({ business });
        return { section, data: mapped[section] };
      }
      case "list_goals": {
        const { limit, status } = listGoalsArgs.parse(raw);
        const queryLimit =
          status === "completed"
            ? Math.min(limit, remainingCompletedItems)
            : limit;
        if (status === "completed" && queryLimit === 0) return [];
        let query = supabase
          .from("goals")
          .select(
            "id,title,description,target_date,status,completed_at,created_at,updated_at",
          )
          .eq("business_id", businessId)
          .order(status === "completed" ? "completed_at" : "updated_at", {
            ascending: false,
          })
          .limit(queryLimit);
        query = query.eq("status", status || "incomplete");
        const { data: goals, error } = await query;
        if (error) throw new Error("GOAL_RETRIEVAL_FAILED");
        if (status === "completed")
          remainingCompletedItems -= (goals || []).length;
        const ids = (goals || []).map((goal) => goal.id);
        const { data: tasks, error: taskError } = ids.length
          ? await supabase
              .from("tasks")
              .select("goal_id,status")
              .eq("business_id", businessId)
              .in("goal_id", ids)
          : { data: [], error: null };
        if (taskError) throw new Error("GOAL_RETRIEVAL_FAILED");
        return (goals || []).map((goal) => {
          const related = (tasks || []).filter(
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
      }
      case "list_tasks": {
        const args = listTasksArgs.parse(raw);
        const queryLimit =
          args.status === "completed"
            ? Math.min(args.limit, remainingCompletedItems)
            : args.limit;
        if (args.status === "completed" && queryLimit === 0) return [];
        let query = supabase
          .from("tasks")
          .select(
            "id,title,description,due_date,priority,status,completed_at,goal_id,origin,created_at,updated_at",
          )
          .eq("business_id", businessId)
          .order(args.status === "completed" ? "completed_at" : "updated_at", {
            ascending: false,
          })
          .limit(queryLimit);
        if (args.goalId) query = query.eq("goal_id", args.goalId);
        if (args.status) query = query.eq("status", args.status);
        else query = query.neq("status", "completed");
        if (args.priority) query = query.eq("priority", args.priority);
        if (args.dueBefore) query = query.lte("due_date", args.dueBefore);
        if (args.dueAfter) query = query.gte("due_date", args.dueAfter);
        const { data, error } = await query;
        if (error) throw new Error("TASK_RETRIEVAL_FAILED");
        if (args.status === "completed")
          remainingCompletedItems -= (data || []).length;
        return data || [];
      }
      case "get_task": {
        const { id } = idArgs.parse(raw);
        const { data, error } = await supabase
          .from("tasks")
          .select(
            "id,title,description,due_date,priority,status,completed_at,goal_id,origin,created_at,updated_at",
          )
          .eq("id", id)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error) throw new Error("TASK_RETRIEVAL_FAILED");
        if (data?.status === "completed") {
          if (remainingCompletedItems === 0)
            return {
              found: false,
              reason: "The completed-work context limit has been reached.",
            };
          remainingCompletedItems -= 1;
        }
        return data || { found: false };
      }
      case "list_conversation_summaries": {
        const { limit } = listSummariesArgs.parse(raw);
        const { data, error } = await supabase
          .from("conversations")
          .select("id,title,updated_at,summary")
          .eq("business_id", businessId)
          .neq("id", currentConversationId)
          .not("summary_updated_at", "is", null)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error("CONVERSATION_RETRIEVAL_FAILED");
        return (data || []).map((conversation) => ({
          ...conversation,
          summary: conversationSummarySchema.parse(conversation.summary),
        }));
      }
      case "get_conversation_details": {
        const args = conversationDetailsArgs.parse(raw);
        const { data: conversation, error } = await supabase
          .from("conversations")
          .select("id,title,updated_at,summary,summarized_message_count")
          .eq("id", args.id)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error || !conversation) return { found: false, messages: [] };
        const { data: messages, error: messageError } = await supabase
          .from("messages")
          .select("role,content,created_at")
          .eq("conversation_id", args.id)
          .eq("business_id", businessId)
          .order("created_at", { ascending: true })
          .range(args.offset, args.offset + args.limit - 1);
        if (messageError) throw new Error("CONVERSATION_RETRIEVAL_FAILED");
        return {
          conversation,
          messages: messages || [],
          page: { offset: args.offset, limit: args.limit },
        };
      }
      default:
        throw new Error("UNAPPROVED_RETRIEVAL_TOOL");
    }
  };
}
