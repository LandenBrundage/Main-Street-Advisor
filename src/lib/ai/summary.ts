import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_RECENT_MESSAGE_LIMIT,
  AI_SUMMARY_BATCH_SIZE,
  AI_SUMMARY_TRIGGER_MESSAGES,
} from "@/lib/config";
import {
  conversationSummarySchema,
  type ConversationSummary,
} from "@/lib/schemas";
import {
  enforceResponseModeration,
  responseModerationConfig,
} from "@/lib/ai/moderation";

type SummaryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const EMPTY_SUMMARY: ConversationSummary = {
  confirmedFacts: [],
  decisions: [],
  goalsAndConstraints: [],
  recommendedStrategies: [],
  confirmedActionsTried: [],
  confirmedResults: [],
  unresolvedQuestions: [],
};

export function selectSummaryBatch({
  messages,
  recentMessageLimit = AI_RECENT_MESSAGE_LIMIT,
  batchSize = AI_SUMMARY_BATCH_SIZE,
  triggerMessages = AI_SUMMARY_TRIGGER_MESSAGES,
}: {
  messages: SummaryMessage[];
  recentMessageLimit?: number;
  batchSize?: number;
  triggerMessages?: number;
}) {
  if (messages.length <= triggerMessages) return [];
  const available = Math.max(0, messages.length - recentMessageLimit);
  return messages.slice(0, Math.min(available, batchSize));
}

export async function maybeSummarizeConversation({
  openai,
  model,
  supabase,
  businessId,
  conversationId,
  safetyIdentifier,
}: {
  openai: OpenAI;
  model: string;
  supabase: SupabaseClient;
  businessId: string;
  conversationId: string;
  safetyIdentifier: string;
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("summary,summarized_message_count")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .single();
  if (conversationError || !conversation) return { summarized: false };
  const summarizedCount = Number(conversation.summarized_message_count || 0);
  const fetchLimit =
    AI_SUMMARY_TRIGGER_MESSAGES +
    AI_SUMMARY_BATCH_SIZE +
    AI_RECENT_MESSAGE_LIMIT;
  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .range(summarizedCount, summarizedCount + fetchLimit - 1);
  if (error) return { summarized: false };
  const batch = selectSummaryBatch({
    messages: (data || []) as SummaryMessage[],
  });
  if (!batch.length) return { summarized: false };

  const previous =
    conversationSummarySchema.safeParse(conversation.summary).data ||
    EMPTY_SUMMARY;
  const nextSummary = await summarizeMessages({
    openai,
    model,
    previous,
    messages: batch,
    safetyIdentifier,
  });
  const throughCount = summarizedCount + batch.length;
  const boundary = batch.at(-1)!;
  const { data: stored, error: storeError } = await supabase.rpc(
    "store_conversation_summary",
    {
      p_conversation_id: conversationId,
      p_business_id: businessId,
      p_expected_message_count: summarizedCount,
      p_through_message_count: throughCount,
      p_through_message_id: boundary.id,
      p_summary: nextSummary,
    },
  );
  return {
    summarized: !storeError && Boolean(stored),
    throughMessageCount: throughCount,
  };
}

async function summarizeMessages({
  openai,
  model,
  previous,
  messages,
  safetyIdentifier,
}: {
  openai: OpenAI;
  model: string;
  previous: ConversationSummary;
  messages: SummaryMessage[];
  safetyIdentifier: string;
}) {
  const response = await openai.responses.create({
    model,
    instructions:
      "Maintain conservative business memory. Merge the prior summary with the supplied message segment. Only put information in confirmedFacts, confirmedActionsTried, or confirmedResults when the user explicitly stated or confirmed it. Assistant recommendations belong only in recommendedStrategies. Never infer task completion, results, or actions taken. Keep each item concise and remove duplicates.",
    input: JSON.stringify({
      previousSummary: previous,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    text: {
      format: {
        type: "json_schema",
        name: "conversation_memory",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "confirmedFacts",
            "decisions",
            "goalsAndConstraints",
            "recommendedStrategies",
            "confirmedActionsTried",
            "confirmedResults",
            "unresolvedQuestions",
          ],
          properties: Object.fromEntries(
            Object.keys(EMPTY_SUMMARY).map((key) => [
              key,
              {
                type: "array",
                maxItems: 30,
                items: { type: "string", maxLength: 500 },
              },
            ]),
          ),
        },
      },
    },
    max_output_tokens: 1600,
    moderation: responseModerationConfig,
    safety_identifier: safetyIdentifier,
    store: false,
  });
  enforceResponseModeration(response);
  return conversationSummarySchema.parse(JSON.parse(response.output_text));
}
