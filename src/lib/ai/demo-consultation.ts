import type OpenAI from "openai";
import { buildAIContext } from "@/lib/ai/context-builder";
import {
  createDemoContextSource,
  createDemoRetrievalExecutor,
} from "@/lib/ai/demo-runtime";
import { requestConsultantResponse } from "@/lib/ai/respond";
import { createConversationTitle } from "@/lib/ai/title";
import { privacyScopedRetrievalToolNames } from "@/lib/ai/retrieval-tools";
import type { AIPrivacySettings } from "@/lib/privacy";
import { DEFAULT_AI_PRIVACY_SETTINGS } from "@/lib/privacy";
import { validateTaskPlan } from "@/lib/ai/tools";
import {
  addDemoMessage,
  createDemoCompletionRequest,
  createDemoProposal,
  getDemoAIData,
  getDemoConversation,
  getDemoWorkspace,
  getDemoMessage,
  renameDemoConversation,
  startDemoConversation,
  updateDemoMessageMetadata,
} from "@/lib/demo-store";
import { taskCompletionProposalSchema } from "@/lib/schemas";

export async function runDemoAIConsultation({
  openai,
  model,
  message,
  conversationId,
  onTitleError,
  privacySettings = DEFAULT_AI_PRIVACY_SETTINGS,
  safetyIdentifier = "local-test-safety-id",
  allowActionTools = true,
  taskPlanSourceMessageId,
}: {
  openai: OpenAI;
  model: string;
  message: string;
  conversationId?: string;
  onTitleError?: (error: unknown) => void;
  privacySettings?: AIPrivacySettings;
  safetyIdentifier?: string;
  allowActionTools?: boolean;
  taskPlanSourceMessageId?: string;
}) {
  const existing = conversationId ? getDemoConversation(conversationId) : null;
  if (conversationId && !existing) throw new Error("CONVERSATION_NOT_FOUND");
  const isNew = !existing;
  const conversation = existing || startDemoConversation("New consultation");
  const sourceMessage = taskPlanSourceMessageId
    ? getDemoMessage(taskPlanSourceMessageId)
    : null;
  if (
    taskPlanSourceMessageId &&
    (!sourceMessage ||
      sourceMessage.conversation_id !== conversation.id ||
      sourceMessage.role !== "assistant" ||
      sourceMessage.metadata?.can_create_task_plan !== true)
  ) {
    throw new Error("TASK_PLAN_SOURCE_NOT_AVAILABLE");
  }
  addDemoMessage({
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  const context = await buildAIContext({
    source: createDemoContextSource(),
    conversationId: conversation.id,
    privacySettings,
  });
  const allowedRetrievalToolNames =
    privacyScopedRetrievalToolNames(privacySettings);
  const response = await requestConsultantResponse({
    openai,
    model,
    context: context.instructionsContext,
    messages: context.messages,
    safetyIdentifier,
    allowActionTools,
    allowedRetrievalToolNames,
    executeRetrieval: createDemoRetrievalExecutor({
      currentConversationId: conversation.id,
      recentCompletedCount: context.diagnostics.recentCompletedCount,
    }),
  });

  const { user } = getDemoWorkspace();
  const planCall = response.actionCalls.find(
    (item) => item.name === "create_task_plan",
  );
  let proposal = null;
  if (planCall) {
    const plan = validateTaskPlan(JSON.parse(planCall.arguments));
    const saved = createDemoProposal({
      conversationId: conversation.id,
      createdBy: user.id,
      idempotencyKey: taskPlanSourceMessageId
        ? [conversation.id, "recommendation", taskPlanSourceMessageId].join(":")
        : [conversation.id, planCall.callId].join(":"),
      payload: plan,
    });
    proposal = { id: saved.id, ...plan };
  }

  const completionCall = response.actionCalls.find(
    (item) => item.name === "propose_task_completion",
  );
  let completionProposal = null;
  if (completionCall) {
    const proposed = taskCompletionProposalSchema.parse(
      JSON.parse(completionCall.arguments),
    );
    const saved = createDemoCompletionRequest({
      conversationId: conversation.id,
      taskId: proposed.taskId,
      idempotencyKey: [conversation.id, completionCall.callId].join(":"),
      confirmationText: proposed.confirmationText,
    });
    const task = getDemoAIData().tasks.find(
      (item) => item.id === proposed.taskId,
    );
    if (saved && task)
      completionProposal = {
        id: saved.id,
        confirmationText: saved.confirmation_text,
        task: { id: task.id, title: task.title, status: task.status },
      };
  }

  const assistantContent =
    (response.moderationBlocked
      ? "I can’t provide that response safely. Please rephrase the request around a legitimate business, workplace-safety, or risk-management need."
      : response.output_text) ||
    (proposal
      ? "I prepared an action plan for your approval."
      : "The AI response was empty. Please try again.");
  const canCreateTaskPlan = Boolean(
    response.actionCalls.some((item) => item.name === "suggest_task_plan") &&
    !proposal &&
    !taskPlanSourceMessageId &&
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
  const assistantMessage = addDemoMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantContent,
    metadata: assistantMetadata,
  });
  if (proposal && sourceMessage) {
    updateDemoMessageMetadata(sourceMessage.id, {
      proposal_id: proposal.id,
      task_plan_status: "proposed",
    });
  }

  let title: string | undefined;
  if (isNew) {
    title = await createConversationTitle({
      openai,
      model,
      message,
      safetyIdentifier,
      onError: onTitleError,
    });
    renameDemoConversation(conversation.id, title);
  }
  return {
    conversationId: conversation.id,
    title,
    message: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      created_at: assistantMessage.created_at,
      metadata: assistantMessage.metadata,
    },
    proposal,
    completionProposal,
  };
}
