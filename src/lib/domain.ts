export type TaskStatus = "todo" | "in_progress" | "completed";
export type GoalStatus = "incomplete" | "completed";
export type Priority = "na" | "low" | "medium" | "high";
export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  completed_at: string | null;
  previous_incomplete_status: Exclude<TaskStatus, "completed"> | null;
  goal_id: string | null;
  origin: "manual" | "ai";
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};
export function goalProgress(tasks: Pick<Task, "status">[]) {
  if (!tasks.length) return 0;
  return Math.round(
    (tasks.filter((task) => task.status === "completed").length /
      tasks.length) *
      100,
  );
}
export function goalProgressLabel(tasks: Pick<Task, "status">[]) {
  if (!tasks.length) return "No tasks assigned";
  const completed = tasks.filter((task) => task.status === "completed").length;
  return `${completed} of ${tasks.length} tasks completed`;
}
export function isDuplicateProposal(
  existing: { idempotency_key: string; status: string }[],
  key: string,
) {
  return existing.some(
    (value) =>
      value.idempotency_key === key &&
      ["proposed", "approved"].includes(value.status),
  );
}
export const priorityWeight: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  na: 0,
};
