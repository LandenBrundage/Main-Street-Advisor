import { NextResponse } from "next/server";
import {
  getDemoConversation,
  getDemoPendingActions,
  listDemoConversationMessages,
  deleteDemoConversation,
} from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { requireWorkspace } from "@/lib/supabase/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (ENABLE_DEMO_MODE) {
      const conversation = getDemoConversation(id);
      if (!conversation)
        throw new AppError(
          "CONVERSATION_NOT_FOUND",
          "That consultation could not be found in this workspace.",
          404,
        );
      return NextResponse.json({
        conversation,
        messages: listDemoConversationMessages(id),
        ...getDemoPendingActions(id),
      });
    }
    const { supabase, businessId } = await requireWorkspace();
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();
    if (error || !conversation)
      throw new AppError(
        "CONVERSATION_NOT_FOUND",
        "That consultation could not be found in this workspace.",
        404,
      );
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id,role,content,created_at,metadata")
      .eq("conversation_id", id)
      .eq("business_id", businessId)
      .order("created_at");
    if (messagesError)
      throw new AppError(
        "CONVERSATION_LOAD_FAILED",
        "The consultation messages could not be loaded.",
      );
    const proposalId = findLatestMetadataId(messages || [], "proposal_id");
    const completionId = findLatestMetadataId(
      messages || [],
      "completion_request_id",
    );
    const [{ data: proposalRecord }, { data: completionRecord }] =
      await Promise.all([
        proposalId
          ? supabase
              .from("ai_action_requests")
              .select("id,payload,status")
              .eq("id", proposalId)
              .eq("business_id", businessId)
              .eq("status", "proposed")
              .maybeSingle()
          : Promise.resolve({ data: null }),
        completionId
          ? supabase
              .from("task_completion_requests")
              .select("id,confirmation_text,status,task_id")
              .eq("id", completionId)
              .eq("business_id", businessId)
              .eq("status", "proposed")
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    let completionProposal = null;
    if (completionRecord) {
      const { data: task } = await supabase
        .from("tasks")
        .select("id,title,status")
        .eq("id", completionRecord.task_id)
        .eq("business_id", businessId)
        .maybeSingle();
      if (task && task.status !== "completed")
        completionProposal = {
          id: completionRecord.id,
          confirmationText: completionRecord.confirmation_text,
          task,
        };
    }
    return NextResponse.json({
      conversation,
      messages: messages || [],
      proposal: proposalRecord
        ? { id: proposalRecord.id, ...proposalRecord.payload }
        : null,
      completionProposal,
    });
  } catch (error) {
    safeDiagnostic("conversation-detail", error);
    return apiError(error);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (ENABLE_DEMO_MODE) {
      if (!deleteDemoConversation(id))
        throw new AppError(
          "CONVERSATION_NOT_FOUND",
          "That consultation could not be found in this workspace.",
          404,
        );
      return new NextResponse(null, { status: 204 });
    }
    const { supabase, businessId } = await requireWorkspace();
    const { data: conversation, error: lookupError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (lookupError || !conversation)
      throw new AppError(
        "CONVERSATION_NOT_FOUND",
        "That consultation could not be found in this workspace.",
        404,
      );
    const [{ error: actionError }, { error: completionError }] =
      await Promise.all([
        supabase
          .from("ai_action_requests")
          .delete()
          .eq("conversation_id", id)
          .eq("business_id", businessId),
        supabase
          .from("task_completion_requests")
          .delete()
          .eq("conversation_id", id)
          .eq("business_id", businessId),
      ]);
    if (actionError || completionError)
      throw new AppError(
        "CONVERSATION_DELETE_FAILED",
        "That consultation could not be deleted completely.",
      );
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);
    if (error)
      throw new AppError(
        "CONVERSATION_DELETE_FAILED",
        "That consultation could not be deleted.",
      );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    safeDiagnostic("conversation-delete", error);
    return apiError(error);
  }
}

function findLatestMetadataId(
  messages: Array<{ metadata: unknown }>,
  key: string,
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index].metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
      continue;
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return null;
}
