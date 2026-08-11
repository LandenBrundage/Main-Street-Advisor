import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import {
  type DemoTaskInput,
  deleteDemoTask,
  getDemoTasksAndGoals,
  saveDemoTask,
} from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { taskSchema } from "@/lib/schemas";
import { requireWorkspace } from "@/lib/supabase/server";

const updateSchema = taskSchema.extend({ id: z.uuid() });
const TASK_FIELDS =
  "id,title,description,due_date,priority,status,completed_at,previous_incomplete_status,goal_id,origin,sort_order,created_at,updated_at";
const GOAL_FIELDS =
  "id,title,description,target_date,status,completed_at,created_at,updated_at";
export async function GET() {
  try {
    if (ENABLE_DEMO_MODE) {
      const { tasks, goals } = getDemoTasksAndGoals();
      return NextResponse.json({ tasks, goals });
    }
    const { supabase, businessId } = await requireWorkspace();
    const [{ data: tasks, error }, { data: goals, error: goalsError }] =
      await Promise.all([
        supabase
          .from("tasks")
          .select(TASK_FIELDS)
          .eq("business_id", businessId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("goals")
          .select(GOAL_FIELDS)
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
      ]);
    if (error || goalsError)
      throw new AppError(
        "TASKS_LOAD_FAILED",
        "Tasks and goals could not be loaded.",
      );
    return NextResponse.json({ tasks: tasks || [], goals: goals || [] });
  } catch (error) {
    safeDiagnostic("tasks-list", error);
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const input = taskSchema.parse(await request.json());
      const task = saveDemoTask({
        title: input.title,
        description: input.description || "",
        dueDate: input.dueDate || "",
        priority: input.priority,
        status: input.status,
        goalId: input.goalId || null,
      } as DemoTaskInput & { id?: string });
      return NextResponse.json({ task }, { status: 201 });
    }
    const { supabase, businessId, user } = await requireWorkspace();
    const input = taskSchema.parse(await request.json());
    if (input.goalId)
      await assertGoalOwnership(supabase, businessId, input.goalId);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        business_id: businessId,
        created_by: user.id,
        title: input.title,
        description: input.description || null,
        due_date: input.dueDate || null,
        priority: input.priority,
        status: input.status,
        goal_id: input.goalId || null,
        origin: "manual",
      })
      .select(TASK_FIELDS)
      .single();
    if (error)
      throw new AppError(
        "TASK_CREATE_FAILED",
        "The task could not be created. Please try again.",
      );
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    safeDiagnostic("task-create", error);
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const input = updateSchema.parse(await request.json());
      const task = saveDemoTask({
        id: input.id,
        title: input.title,
        description: input.description || "",
        dueDate: input.dueDate || "",
        priority: input.priority,
        status: input.status,
        goalId: input.goalId || null,
      } as DemoTaskInput & { id?: string });
      if (!task)
        throw new AppError(
          "TASK_UPDATE_FAILED",
          "The task could not be updated. Please try again.",
        );
      return NextResponse.json({ task });
    }
    const { supabase, businessId } = await requireWorkspace();
    const input = updateSchema.parse(await request.json());
    if (input.goalId)
      await assertGoalOwnership(supabase, businessId, input.goalId);
    const { data, error } = await supabase
      .from("tasks")
      .update({
        title: input.title,
        description: input.description || null,
        due_date: input.dueDate || null,
        priority: input.priority,
        status: input.status,
        goal_id: input.goalId || null,
      })
      .eq("id", input.id)
      .eq("business_id", businessId)
      .select(TASK_FIELDS)
      .single();
    if (error)
      throw new AppError(
        "TASK_UPDATE_FAILED",
        "The task could not be updated. Please try again.",
      );
    return NextResponse.json({ task: data });
  } catch (error) {
    safeDiagnostic("task-update", error);
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      if (!deleteDemoTask(id))
        throw new AppError(
          "TASK_DELETE_FAILED",
          "The task could not be deleted.",
        );
      return new NextResponse(null, { status: 204 });
    }
    const { supabase, businessId } = await requireWorkspace();
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new AppError(
        "TASK_DELETE_FAILED",
        "The task could not be deleted.",
      );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    safeDiagnostic("task-delete", error);
    return apiError(error);
  }
}
async function assertGoalOwnership(
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"],
  businessId: string,
  goalId: string,
) {
  const { data } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data)
    throw new AppError(
      "GOAL_NOT_FOUND",
      "The selected goal is not available in this workspace.",
      400,
    );
}
