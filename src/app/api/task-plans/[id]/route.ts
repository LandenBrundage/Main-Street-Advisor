import { NextResponse } from "next/server";
import {
  cancelDemoProposal,
  getDemoProposal,
  updateDemoProposal,
} from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { taskPlanSchema } from "@/lib/schemas";
import { requireWorkspace } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const plan = taskPlanSchema.parse(await request.json());
    if (ENABLE_DEMO_MODE) {
      const current = getDemoProposal(id);
      if (!current)
        throw new AppError(
          "PROPOSAL_NOT_FOUND",
          "That task proposal is not available in this workspace.",
          404,
        );
      if (current.status !== "proposed")
        throw new AppError(
          "PROPOSAL_NOT_PENDING",
          "That task proposal is no longer available to edit.",
          409,
        );
      const updated = updateDemoProposal(id, plan);
      return NextResponse.json({
        saved: true,
        proposal: { id: updated!.id, ...updated!.payload },
      });
    }

    const { supabase, businessId } = await requireWorkspace();
    const { data: current } = await supabase
      .from("ai_action_requests")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!current)
      throw new AppError(
        "PROPOSAL_NOT_FOUND",
        "That task proposal is not available in this workspace.",
        404,
      );
    if (current.status !== "proposed")
      throw new AppError(
        "PROPOSAL_NOT_PENDING",
        "That task proposal is no longer available to edit.",
        409,
      );
    const { data, error } = await supabase
      .from("ai_action_requests")
      .update({ payload: plan })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("status", "proposed")
      .select("id,payload")
      .maybeSingle();
    if (error || !data)
      throw new AppError(
        "PROPOSAL_UPDATE_FAILED",
        "The task proposal could not be updated. Nothing was approved.",
      );
    return NextResponse.json({
      saved: true,
      proposal: { id: data.id, ...taskPlanSchema.parse(data.payload) },
    });
  } catch (error) {
    safeDiagnostic("proposal-update", error);
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
      const current = getDemoProposal(id);
      if (!current)
        throw new AppError(
          "PROPOSAL_NOT_FOUND",
          "That task proposal is not available in this workspace.",
          404,
        );
      if (current.status === "approved")
        throw new AppError(
          "PROPOSAL_ALREADY_APPROVED",
          "That task proposal was already approved and cannot be cancelled.",
          409,
        );
      if (current.status === "cancelled")
        return NextResponse.json({ cancelled: true });
      cancelDemoProposal(id);
      return NextResponse.json({ cancelled: true });
    }

    const { supabase, businessId } = await requireWorkspace();
    const { data: current } = await supabase
      .from("ai_action_requests")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!current)
      throw new AppError(
        "PROPOSAL_NOT_FOUND",
        "That task proposal is not available in this workspace.",
        404,
      );
    if (current.status === "approved")
      throw new AppError(
        "PROPOSAL_ALREADY_APPROVED",
        "That task proposal was already approved and cannot be cancelled.",
        409,
      );
    if (current.status !== "cancelled") {
      const { error } = await supabase
        .from("ai_action_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("business_id", businessId)
        .eq("status", "proposed");
      if (error)
        throw new AppError(
          "PROPOSAL_CANCEL_FAILED",
          "The task proposal could not be cancelled.",
        );
    }
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    safeDiagnostic("proposal-cancel", error);
    return apiError(error);
  }
}
