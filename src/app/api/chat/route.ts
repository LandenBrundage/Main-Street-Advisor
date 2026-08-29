import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAIContext,
  createSupabaseContextSource,
} from "@/lib/ai/context-builder";
import { runDemoAIConsultation } from "@/lib/ai/demo-consultation";
import {
  createRetrievalExecutor,
  privacyScopedRetrievalToolNames,
} from "@/lib/ai/retrieval-tools";
import {
  moderateUserMessage,
  ModerationBlockedError,
  ModerationUnavailableError,
} from "@/lib/ai/moderation";
import { requestConsultantResponse } from "@/lib/ai/respond";
import { maybeSummarizeConversation } from "@/lib/ai/summary";
import { validateTaskPlan } from "@/lib/ai/tools";
import { createConversationTitle } from "@/lib/ai/title";
import {
  ENABLE_AI_MOCKS,
  ENABLE_DEMO_AI,
  ENABLE_DEMO_MODE,
  OPENAI_MODEL,
} from "@/lib/config";
import {
  generateDemoConsultation,
  getDemoAIPrivacySettings,
  getDemoConversation,
  getDemoWorkspace,
} from "@/lib/demo-store";
import {
  apiError,
  AppError,
  consumeDurableRateLimit,
  rateLimit,
  safeDiagnostic,
} from "@/lib/http";
import {
  createSafetyIdentifier,
  detectHighRiskSecret,
  type AIPrivacySettings,
} from "@/lib/privacy";
import { requireWorkspace } from "@/lib/supabase/server";
import { taskCompletionProposalSchema } from "@/lib/schemas";

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(12_000),
  taskPlanSourceMessageId: z.uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (detectHighRiskSecret(body.message))
      throw new AppError(
        "SENSITIVE_DATA_DETECTED",
        "Please remove payment-card numbers, Social Security numbers, private keys, or API keys before sending this message.",
        422,
      );
    if (ENABLE_DEMO_MODE) {
      if (body.conversationId && !getDemoConversation(body.conversationId))
        throw new AppError(
          "CONVERSATION_NOT_FOUND",
          "That consultation could not be loaded in this workspace.",
          404,
        );
      if (ENABLE_DEMO_AI) {
        if (!process.env.OPENAI_API_KEY)
          throw new AppError(
            "OPENAI_NOT_CONFIGURED",
            "Real AI is enabled for this example workspace, but OPENAI_API_KEY is missing from the server environment.",
            503,
          );
        if (!rateLimit("fictional-customer-demo:chat"))
          throw new AppError(
            "RATE_LIMITED",
            "You’ve sent several demo requests quickly. Please wait a minute and try again.",
            429,
          );
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const moderation = await moderateUserMessage(openai, body.message);
        if (moderation.blocked) throw new ModerationBlockedError("input");
        const { user } = getDemoWorkspace();
        const result = await runDemoAIConsultation({
          openai,
          model: OPENAI_MODEL,
          message: body.message,
          conversationId: body.conversationId,
          privacySettings: getDemoAIPrivacySettings(),
          safetyIdentifier: await createSafetyIdentifier(user.id),
          allowActionTools: !moderation.flagged,
          taskPlanSourceMessageId: body.taskPlanSourceMessageId,
          onTitleError: (error) =>
            safeDiagnostic("demo-conversation-title", error),
        });
        return NextResponse.json(result);
      }
      const result = generateDemoConsultation({
        message: body.message,
        conversationId: body.conversationId,
        taskPlanSourceMessageId: body.taskPlanSourceMessageId,
      });
      return NextResponse.json({
        conversationId: result.conversationId,
        title: result.title,
        message: {
          id: result.assistantMessage.id,
          role: result.assistantMessage.role,
          content: result.assistantMessage.content,
          created_at: result.assistantMessage.created_at,
          metadata: result.assistantMessage.metadata,
        },
        proposal: result.proposal,
        completionProposal: null,
      });
    }
    const { supabase, user, businessId } = await requireWorkspace();
    if (!(await consumeDurableRateLimit(supabase, "chat", 20, 60)))
      throw new AppError(
        "RATE_LIMITED",
        "You’ve sent several requests quickly. Please wait a minute and try again.",
        429,
      );
    if (!process.env.OPENAI_API_KEY && !ENABLE_AI_MOCKS)
      throw new AppError(
        "OPENAI_NOT_CONFIGURED",
        "The AI consultant has not been configured. Add OPENAI_API_KEY to the server environment.",
        503,
      );

    const openai = ENABLE_AI_MOCKS
      ? null
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const safetyIdentifier = await createSafetyIdentifier(user.id);
    let moderationFlagged = false;
    if (openai) {
      const moderation = await moderateUserMessage(openai, body.message);
      if (moderation.blocked) throw new ModerationBlockedError("input");
      moderationFlagged = moderation.flagged;
    }
    const { data: privacyRow, error: privacyError } = await supabase
      .from("businesses")
      .select(
        "ai_workspace_context_enabled,ai_cross_conversation_enabled,ai_document_search_enabled",
      )
      .eq("id", businessId)
      .single();
    if (privacyError || !privacyRow)
      throw new AppError(
        "PRIVACY_SETTINGS_UNAVAILABLE",
        "AI privacy controls are unavailable. Apply the latest database migration and try again.",
        503,
      );
    const privacySettings: AIPrivacySettings = {
      workspaceContextEnabled: privacyRow.ai_workspace_context_enabled,
      crossConversationEnabled: privacyRow.ai_cross_conversation_enabled,
      documentSearchEnabled: privacyRow.ai_document_search_enabled,
    };
    const allowedRetrievalToolNames =
      privacyScopedRetrievalToolNames(privacySettings);

    if (body.taskPlanSourceMessageId && !body.conversationId)
      throw new AppError(
        "TASK_PLAN_SOURCE_NOT_AVAILABLE",
        "That recommendation is not available in this consultation.",
        422,
      );

    let conversationId = body.conversationId;
    let isNew = false;
    if (conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .single();
      if (error || !data)
        throw new AppError(
          "CONVERSATION_NOT_FOUND",
          "That consultation could not be loaded in this workspace.",
          404,
        );
    } else {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          business_id: businessId,
          created_by: user.id,
          title: "New consultation",
        })
        .select("id")
        .single();
      if (error)
        throw new AppError(
          "CONVERSATION_CREATE_FAILED",
          "The consultation could not be started. Please try again.",
        );
      conversationId = data.id;
      isNew = true;
    }
    if (!conversationId)
      throw new AppError(
        "CONVERSATION_CREATE_FAILED",
        "The consultation could not be started. Please try again.",
      );
    const activeConversationId = conversationId;

    let taskPlanSourceMessage: {
      id: string;
      metadata: Record<string, unknown>;
    } | null = null;
    if (body.taskPlanSourceMessageId) {
      const { data: source } = await supabase
        .from("messages")
        .select("id,metadata")
        .eq("id", body.taskPlanSourceMessageId)
        .eq("conversation_id", activeConversationId)
        .eq("business_id", businessId)
        .eq("role", "assistant")
        .maybeSingle();
      const metadata = asMetadata(source?.metadata);
      if (!source || metadata.can_create_task_plan !== true)
        throw new AppError(
          "TASK_PLAN_SOURCE_NOT_AVAILABLE",
          "That recommendation is not available for goal and task creation.",
          422,
        );
      if (["approved", "cancelled"].includes(String(metadata.task_plan_status)))
        throw new AppError(
          "TASK_PLAN_ALREADY_HANDLED",
          metadata.task_plan_status === "approved"
            ? "A goal and tasks were already created from that recommendation."
            : "That goal and task suggestion was already dismissed.",
          409,
        );
      taskPlanSourceMessage = { id: source.id, metadata };
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      business_id: businessId,
      role: "user",
      content: body.message,
      metadata: taskPlanSourceMessage
        ? { task_plan_source_message_id: taskPlanSourceMessage.id }
        : null,
    });
    if (userMessageError)
      throw new AppError(
        "MESSAGE_SAVE_FAILED",
        "Your message could not be saved. Please try again.",
      );

    if (openai) {
      try {
        await maybeSummarizeConversation({
          openai,
          model: OPENAI_MODEL,
          supabase,
          businessId,
          conversationId: activeConversationId,
          safetyIdentifier,
        });
      } catch (summaryError) {
        safeDiagnostic("conversation-summary", summaryError);
      }
    }
    const context = await buildAIContext({
      source: createSupabaseContextSource({ supabase, businessId }),
      conversationId: activeConversationId,
      privacySettings,
    });
    const { data: document } = privacySettings.documentSearchEnabled
      ? await supabase
          .from("documents")
          .select("vector_store_id")
          .eq("business_id", businessId)
          .eq("status", "ready")
          .not("vector_store_id", "is", null)
          .limit(1)
          .maybeSingle()
      : { data: null };

    const response = ENABLE_AI_MOCKS
      ? mockResponse(body.message)
      : await requestConsultantResponse({
          openai: openai!,
          model: OPENAI_MODEL,
          context: context.instructionsContext,
          messages: context.messages,
          vectorStoreId: document?.vector_store_id || undefined,
          safetyIdentifier,
          allowActionTools: !moderationFlagged,
          allowedRetrievalToolNames,
          executeRetrieval: createRetrievalExecutor({
            supabase,
            businessId,
            currentConversationId: activeConversationId,
            recentCompletedCount: context.diagnostics.recentCompletedCount,
            allowedToolNames: allowedRetrievalToolNames,
          }),
        });

    const call = response.actionCalls.find(
      (item) => item.name === "create_task_plan",
    );
    let proposal;
    if (call) {
      const plan = validateTaskPlan(JSON.parse(call.arguments));
      const idempotencyKey = await hash(
        taskPlanSourceMessage
          ? `${activeConversationId}:recommendation:${taskPlanSourceMessage.id}`
          : `${activeConversationId}:${call.callId}`,
      );
      const { data, error } = await supabase
        .from("ai_action_requests")
        .upsert(
          {
            business_id: businessId,
            conversation_id: activeConversationId,
            created_by: user.id,
            idempotency_key: idempotencyKey,
            status: "proposed",
            payload: plan,
          },
          { onConflict: "business_id,idempotency_key", ignoreDuplicates: true },
        )
        .select("id,payload,status")
        .maybeSingle();
      if (error)
        throw new AppError(
          "PROPOSAL_SAVE_FAILED",
          "The task proposal could not be saved. Your conversation is still available.",
        );
      if (data) proposal = { id: data.id, ...plan };
      else {
        const { data: existing } = await supabase
          .from("ai_action_requests")
          .select("id,payload,status")
          .eq("business_id", businessId)
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (!existing)
          throw new AppError(
            "PROPOSAL_SAVE_FAILED",
            "The task proposal could not be recovered.",
          );
        if (existing.status === "approved")
          throw new AppError(
            "TASK_PLAN_ALREADY_HANDLED",
            "A goal and tasks were already created from that recommendation.",
            409,
          );
        if (existing.status !== "proposed")
          throw new AppError(
            "TASK_PLAN_ALREADY_HANDLED",
            "That goal and task suggestion is no longer pending.",
            409,
          );
        proposal = { id: existing.id, ...validateTaskPlan(existing.payload) };
      }
    }
    const completionCall = response.actionCalls.find(
      (item) => item.name === "propose_task_completion",
    );
    let completionProposal;
    if (completionCall) {
      const completion = taskCompletionProposalSchema.parse(
        JSON.parse(completionCall.arguments),
      );
      const { data: task } = await supabase
        .from("tasks")
        .select("id,title,status")
        .eq("id", completion.taskId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (task && task.status !== "completed") {
        const idempotencyKey = await hash(
          `${activeConversationId}:${completionCall.callId}`,
        );
        const { data: created, error } = await supabase
          .from("task_completion_requests")
          .upsert(
            {
              business_id: businessId,
              conversation_id: activeConversationId,
              task_id: task.id,
              created_by: user.id,
              idempotency_key: idempotencyKey,
              status: "proposed",
              confirmation_text: completion.confirmationText,
            },
            {
              onConflict: "business_id,idempotency_key",
              ignoreDuplicates: true,
            },
          )
          .select("id")
          .maybeSingle();
        if (error)
          throw new AppError(
            "COMPLETION_PROPOSAL_SAVE_FAILED",
            "The task completion confirmation could not be prepared.",
          );
        let requestId = created?.id;
        if (!requestId) {
          const { data: existing } = await supabase
            .from("task_completion_requests")
            .select("id")
            .eq("business_id", businessId)
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          requestId = existing?.id;
        }
        if (requestId)
          completionProposal = {
            id: requestId,
            confirmationText: completion.confirmationText,
            task,
          };
      }
    }
    const assistantMessage =
      (response.moderationBlocked
        ? "I can’t provide that response safely. Please rephrase the request around a legitimate business, workplace-safety, or risk-management need."
        : response.output_text) ||
      (proposal
        ? "I prepared an action plan for your approval."
        : "The AI response was empty. Please try again.");
    const canCreateTaskPlan = Boolean(
      response.actionCalls.some((item) => item.name === "suggest_task_plan") &&
      !proposal &&
      !taskPlanSourceMessage &&
      !response.moderationBlocked,
    );
    const assistantMetadata =
      proposal || completionProposal || canCreateTaskPlan
        ? {
            ...(proposal ? { proposal_id: proposal.id } : {}),
            ...(completionProposal
              ? { completion_request_id: completionProposal.id }
              : {}),
            ...(canCreateTaskPlan
              ? {
                  can_create_task_plan: true,
                  task_plan_status: "available",
                }
              : {}),
          }
        : null;
    const { data: savedMessage, error: assistantError } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        business_id: businessId,
        role: "assistant",
        content: assistantMessage,
        metadata: assistantMetadata,
      })
      .select("id,created_at")
      .single();
    if (assistantError)
      throw new AppError(
        "MESSAGE_SAVE_FAILED",
        "The response was generated but could not be saved.",
      );
    if (proposal && taskPlanSourceMessage) {
      const { error: sourceUpdateError } = await supabase
        .from("messages")
        .update({
          metadata: {
            ...taskPlanSourceMessage.metadata,
            proposal_id: proposal.id,
            task_plan_status: "proposed",
          },
        })
        .eq("id", taskPlanSourceMessage.id)
        .eq("conversation_id", activeConversationId)
        .eq("business_id", businessId);
      if (sourceUpdateError)
        safeDiagnostic("task-plan-source-update", sourceUpdateError);
    }

    let title: string | undefined;
    if (isNew) {
      title = await createConversationTitle({
        openai,
        model: OPENAI_MODEL,
        message: body.message,
        safetyIdentifier,
        onError: (error) => safeDiagnostic("conversation-title", error),
      });
      await supabase
        .from("conversations")
        .update({ title })
        .eq("id", activeConversationId)
        .eq("business_id", businessId)
        .eq("title", "New consultation");
    }
    return NextResponse.json({
      conversationId: activeConversationId,
      title,
      message: {
        id: savedMessage.id,
        role: "assistant",
        content: assistantMessage,
        created_at: savedMessage.created_at,
        metadata: assistantMetadata,
      },
      proposal,
      completionProposal,
    });
  } catch (error) {
    safeDiagnostic("chat", error);
    if (error instanceof ModerationBlockedError)
      return apiError(
        new AppError(
          "MESSAGE_BLOCKED",
          error.side === "input"
            ? "This message can’t be processed safely. Please rephrase it as a legitimate business or workplace-safety question."
            : "The generated response was withheld by the app’s safety controls.",
          422,
        ),
      );
    if (error instanceof ModerationUnavailableError)
      return apiError(
        new AppError(
          "MODERATION_UNAVAILABLE",
          "The safety check is temporarily unavailable, so the message was not processed. Please try again shortly.",
          503,
        ),
      );
    if (error instanceof OpenAI.APIError)
      return apiError(
        new AppError(
          "OPENAI_REQUEST_FAILED",
          "The AI service could not complete this request. Please try again shortly.",
          502,
        ),
      );
    return apiError(error);
  }
}

async function hash(value: string) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(data))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function mockResponse(message: string): Pick<
  OpenAI.Responses.Response,
  "output" | "output_text"
> & {
  actionCalls: [];
  moderationBlocked?: "output";
} {
  return {
    output: [],
    output_text: `[Explicit AI mock] Received: ${message}`,
    actionCalls: [],
  };
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
