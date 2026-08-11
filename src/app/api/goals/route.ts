import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import {
  deleteDemoGoal,
  saveDemoGoal,
  setDemoGoalCompletion,
} from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { goalCompletionSchema, goalSchema } from "@/lib/schemas";
import { requireWorkspace } from "@/lib/supabase/server";

const GOAL_FIELDS =
  "id,title,description,target_date,status,completed_at,created_at,updated_at";

export async function POST(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const input = goalSchema.parse(await request.json());
      const goal = saveDemoGoal({
        title: input.title,
        description: input.description || "",
      });
      if (!goal)
        throw new AppError(
          "GOAL_CREATE_FAILED",
          "The goal could not be created.",
        );
      return NextResponse.json({ goal }, { status: 201 });
    }
    const { supabase, businessId, user } = await requireWorkspace();
    const input = goalSchema.parse(await request.json());
    const { data, error } = await supabase
      .from("goals")
      .insert({
        business_id: businessId,
        created_by: user.id,
        title: input.title,
        description: input.description || null,
      })
      .select(GOAL_FIELDS)
      .single();
    if (error)
      throw new AppError(
        "GOAL_CREATE_FAILED",
        "The goal could not be created.",
      );
    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    safeDiagnostic("goal-create", error);
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const input = goalSchema
        .extend({ id: z.uuid() })
        .parse(await request.json());
      const goal = saveDemoGoal({
        id: input.id,
        title: input.title,
        description: input.description || "",
      });
      if (!goal)
        throw new AppError(
          "GOAL_UPDATE_FAILED",
          "The goal could not be updated.",
        );
      return NextResponse.json({ goal });
    }
    const { supabase, businessId } = await requireWorkspace();
    const input = goalSchema
      .extend({ id: z.uuid() })
      .parse(await request.json());
    const { data, error } = await supabase
      .from("goals")
      .update({ title: input.title, description: input.description || null })
      .eq("id", input.id)
      .eq("business_id", businessId)
      .select(GOAL_FIELDS)
      .single();
    if (error)
      throw new AppError(
        "GOAL_UPDATE_FAILED",
        "The goal could not be updated.",
      );
    return NextResponse.json({ goal: data });
  } catch (error) {
    safeDiagnostic("goal-update", error);
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const input = goalCompletionSchema.parse(await request.json());
    if (ENABLE_DEMO_MODE) {
      const result = setDemoGoalCompletion({
        goalId: input.id,
        completed: input.completed,
        completeRemainingTasks: input.completeRemainingTasks,
      });
      if (!result)
        throw new AppError(
          "GOAL_COMPLETION_FAILED",
          "The goal could not be updated.",
        );
      return NextResponse.json(result);
    }
    const { supabase, businessId } = await requireWorkspace();
    const { data, error } = await supabase.rpc("set_goal_completion", {
      p_goal_id: input.id,
      p_business_id: businessId,
      p_completed: input.completed,
      p_complete_remaining_tasks: input.completeRemainingTasks,
    });
    if (error || !data)
      throw new AppError(
        "GOAL_COMPLETION_FAILED",
        input.completed
          ? "The goal could not be completed. No tasks were changed."
          : "The goal could not be reopened. No tasks were changed.",
      );
    return NextResponse.json(data);
  } catch (error) {
    safeDiagnostic("goal-completion", error);
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      if (!deleteDemoGoal(id))
        throw new AppError(
          "GOAL_DELETE_FAILED",
          "The goal could not be deleted. Its tasks were not changed.",
        );
      return NextResponse.json({ deleted: true });
    }
    const { supabase, businessId } = await requireWorkspace();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await supabase.rpc("delete_goal_keep_tasks", {
      p_goal_id: id,
      p_business_id: businessId,
    });
    if (error || !data)
      throw new AppError(
        "GOAL_DELETE_FAILED",
        "The goal could not be deleted. Its tasks were not changed.",
      );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    safeDiagnostic("goal-delete", error);
    return apiError(error);
  }
}
