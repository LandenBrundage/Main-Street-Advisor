import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import {
  approveDemoCompletionRequest,
  getDemoCompletionRequest,
} from "@/lib/demo-store";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { requireWorkspace } from "@/lib/supabase/server";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (ENABLE_DEMO_MODE) {
      if (!getDemoCompletionRequest(id))
        throw new AppError(
          "COMPLETION_PROPOSAL_NOT_FOUND",
          "That task confirmation is not available in this example workspace.",
          404,
        );
      const result = approveDemoCompletionRequest(id);
      if (!result)
        throw new AppError(
          "TASK_COMPLETION_FAILED",
          "The task could not be marked complete. Nothing was changed.",
        );
      return NextResponse.json({
        approved: true,
        alreadyApproved: result.alreadyApproved,
        task: result.task,
      });
    }
    const { supabase, businessId, user } = await requireWorkspace();
    const { data: request } = await supabase
      .from("task_completion_requests")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!request)
      throw new AppError(
        "COMPLETION_PROPOSAL_NOT_FOUND",
        "That task confirmation is not available in this workspace.",
        404,
      );
    const { data, error } = await supabase.rpc("approve_task_completion", {
      p_request_id: id,
      p_business_id: businessId,
      p_user_id: user.id,
    });
    if (error || !data?.task)
      throw new AppError(
        "TASK_COMPLETION_FAILED",
        "The task could not be marked complete. Nothing was changed.",
      );
    return NextResponse.json({
      approved: true,
      alreadyApproved: Boolean(data.already_approved),
      task: data.task,
    });
  } catch (error) {
    safeDiagnostic("task-completion-approve", error);
    return apiError(error);
  }
}
