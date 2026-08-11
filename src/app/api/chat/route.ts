import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAIContext,
  createSupabaseContextSource,
} from "@/lib/ai/context-builder";
import { runDemoAIConsultation } from "@/lib/ai/demo-consultation";
import { createRetrievalExecutor } from "@/lib/ai/retrieval-tools";
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
  getDemoConversation,
} from "@/lib/demo-store";
import { apiError, AppError, rateLimit, safeDiagnostic } from "@/lib/http";
import { requireWorkspace } from "@/lib/supabase/server";
import { taskCompletionProposalSchema } from "@/lib/schemas";

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(12_000),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
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
        const result = await runDemoAIConsultation({
          openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
          model: OPENAI_MODEL,
          message: body.message,
          conversationId: body.conversationId,
          onTitleError: (error) =>
            safeDiagnostic("demo-conversation-title", error),
        });
        return NextResponse.json(result);
      }
      const result = generateDemoConsultation({
        message: body.message,
        conversationId: body.conversationId,
      });
      return NextResponse.json({
        conversationId: result.conversationId,
        title: result.title,
        message: {
          id: result.assistantMessage.id,
          role: result.assistantMessage.role,
          content: result.assistantMessage.content,
          created_at: result.assistantMessage.created_at,
        },
        proposal: result.proposal,
        completionProposal: null,
      });
    }
    const { supabase, user, businessId } = await requireWorkspace();
    if (!rateLimit(`${user.id}:chat`))
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

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      business_id: businessId,
      role: "user",
      content: body.message,
    });
    if (userMessageError)
      throw new AppError(
        "MESSAGE_SAVE_FAILED",
        "Your message could not be saved. Please try again.",
      );

    const openai = ENABLE_AI_MOCKS
      ? null
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (openai) {
      try {
        await maybeSummarizeConversation({
          openai,
          model: OPENAI_MODEL,
          supabase,
          businessId,
          conversationId: activeConversationId,
        });
      } catch (summaryError) {
        safeDiagnostic("conversation-summary", summaryError);
      }
    }
    const context = await buildAIContext({
      source: createSupabaseContextSource({ supabase, businessId }),
      conversationId: activeConversationId,
    });
    const { data: document } = await supabase
      .from("documents")
      .select("vector_store_id")
      .eq("business_id", businessId)
      .eq("status", "ready")
      .not("vector_store_id", "is", null)
      .limit(1)
      .maybeSingle();

    const response = ENABLE_AI_MOCKS
      ? mockResponse(body.message)
      : await requestConsultantResponse({
          openai: openai!,
          model: OPENAI_MODEL,
          context: context.instructionsContext,
          messages: context.messages,
          vectorStoreId: document?.vector_store_id || undefined,
          executeRetrieval: createRetrievalExecutor({
            supabase,
            businessId,
            currentConversationId: activeConversationId,
            recentCompletedCount: context.diagnostics.recentCompletedCount,
          }),
        });

    const call = response.actionCalls.find(
      (item) => item.name === "create_task_plan",
    );
    let proposal;
    if (call) {
      const plan = validateTaskPlan(JSON.parse(call.arguments));
      const idempotencyKey = await hash(
        `${activeConversationId}:${call.callId}`,
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
        .select("id,payload")
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
          .select("id,payload")
          .eq("business_id", businessId)
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (!existing)
          throw new AppError(
            "PROPOSAL_SAVE_FAILED",
            "The task proposal could not be recovered.",
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
      response.output_text ||
      (proposal
        ? "I prepared an action plan for your approval."
        : "The AI response was empty. Please try again.");
    const { data: savedMessage, error: assistantError } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        business_id: businessId,
        role: "assistant",
        content: assistantMessage,
        metadata:
          proposal || completionProposal
            ? {
                ...(proposal ? { proposal_id: proposal.id } : {}),
                ...(completionProposal
                  ? { completion_request_id: completionProposal.id }
                  : {}),
              }
            : null,
      })
      .select("id,created_at")
      .single();
    if (assistantError)
      throw new AppError(
        "MESSAGE_SAVE_FAILED",
        "The response was generated but could not be saved.",
      );

    let title: string | undefined;
    if (isNew) {
      title = await createConversationTitle({
        openai: ENABLE_AI_MOCKS
          ? null
          : new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
        model: OPENAI_MODEL,
        message: body.message,
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
      },
      proposal,
      completionProposal,
    });
  } catch (error) {
    safeDiagnostic("chat", error);
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
} {
  return {
    output: [],
    output_text: `[Explicit AI mock] Received: ${message}`,
    actionCalls: [],
  };
}
