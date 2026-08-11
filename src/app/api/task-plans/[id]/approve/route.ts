import { NextResponse } from "next/server";
import { approveDemoProposal, getDemoProposal } from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { requireWorkspace } from "@/lib/supabase/server";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (ENABLE_DEMO_MODE) {
      const proposal = getDemoProposal(id);
      if (!proposal)
        throw new AppError(
          "PROPOSAL_NOT_FOUND",
          "That task proposal is not available in this workspace.",
          404,
        );
      const result = approveDemoProposal(id);
      if (!result?.tasks?.length)
        throw new AppError(
          "PROPOSAL_SAVE_FAILED",
          "The proposed tasks could not be saved. Nothing was approved.",
        );
      return NextResponse.json({
        approved: true,
        alreadyApproved: Boolean(result.alreadyApproved),
        goal: result.goal,
        tasks: result.tasks,
      });
    }
    const { supabase, businessId, user } = await requireWorkspace();
    const { data: proposal } = await supabase
      .from("ai_action_requests")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!proposal)
      throw new AppError(
        "PROPOSAL_NOT_FOUND",
        "That task proposal is not available in this workspace.",
        404,
      );
    const { data, error } = await supabase.rpc("approve_task_plan", {
      p_proposal_id: id,
      p_business_id: businessId,
      p_user_id: user.id,
    });
    if (error || !data?.tasks?.length)
      throw new AppError(
        "PROPOSAL_SAVE_FAILED",
        "The proposed tasks could not be saved. Nothing was approved.",
      );
    const { data: goal } = await supabase
      .from("goals")
      .select(
        "id,title,description,target_date,status,completed_at,created_at,updated_at",
      )
      .eq("id", data.goal_id)
      .eq("business_id", businessId)
      .single();
    return NextResponse.json({
      approved: true,
      alreadyApproved: Boolean(data.already_approved),
      goal,
      tasks: data.tasks,
    });
  } catch (error) {
    safeDiagnostic("proposal-approve", error);
    return apiError(error);
  }
}
