"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronDown,
  CircleCheckBig,
  Goal as GoalIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Goal, Priority, Task, TaskStatus } from "@/lib/domain";
import { goalProgress, goalProgressLabel, priorityWeight } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type CompletionTab = "incomplete" | "completed";
type TaskMutation = {
  id?: string;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  goalId: string | null;
};
type PendingDeletion =
  | { kind: "task"; item: Task }
  | { kind: "goal"; item: Goal };

export function TaskManager() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]),
    [goals, setGoals] = useState<Goal[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null),
    [goalDialog, setGoalDialog] = useState<Goal | "new" | null>(null),
    [defaultGoalId, setDefaultGoalId] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [priority, setPriority] = useState("all"),
    [goal, setGoal] = useState(searchParams.get("goal") || "all"),
    [sort, setSort] = useState("updated"),
    [notice, setNotice] = useState("");
  const [goalTab, setGoalTab] = useState<CompletionTab>("incomplete");
  const [taskTab, setTaskTab] = useState<CompletionTab>("incomplete");
  const [goalCompletionDialog, setGoalCompletionDialog] = useState<Goal | null>(
    null,
  );
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTasks(data.tasks);
      setGoals(data.goals);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Tasks could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // The first state update occurs after the fetch resolves; this is initial remote-data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function persistTask(input: TaskMutation) {
    const response = await fetch("/api/tasks", {
      method: input.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "The task could not be saved.");
    return data.task as Task;
  }

  async function saveTask(input: TaskMutation) {
    const savedTask = await persistTask(input);
    setTasks((current) =>
      input.id
        ? current.map((task) => (task.id === savedTask.id ? savedTask : task))
        : [savedTask, ...current],
    );
    setEditing(null);
    setNotice(input.id ? "Task updated." : "Task created.");
    setLoadError("");
  }

  async function deleteTask(task: Task) {
    const response = await fetch(`/api/tasks?id=${task.id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error((await response.json()).error);
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setEditing(null);
    setNotice("Task deleted.");
  }

  async function changeTaskCompletion(task: Task) {
    if (busyTaskId) return;
    const nextStatus: TaskStatus =
      task.status === "completed"
        ? task.previous_incomplete_status || "todo"
        : "completed";
    setBusyTaskId(task.id);
    setLoadError("");
    try {
      const savedTask = await persistTask({
        id: task.id,
        title: task.title,
        description: task.description || "",
        dueDate: task.due_date || "",
        priority: task.priority,
        status: nextStatus,
        goalId: task.goal_id,
      });
      setTasks((current) =>
        current.map((item) => (item.id === savedTask.id ? savedTask : item)),
      );
      setNotice(
        nextStatus === "completed" ? "Task completed." : "Task reopened.",
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The task could not be updated.",
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  async function saveGoal(input: {
    id?: string;
    title: string;
    description: string;
  }) {
    const response = await fetch("/api/goals", {
      method: input.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "The goal could not be saved.");
    setGoals((current) =>
      input.id
        ? current.map((item) => (item.id === data.goal.id ? data.goal : item))
        : [data.goal, ...current],
    );
    setGoalDialog(null);
    setNotice(input.id ? "Goal updated." : "Goal created.");
    setLoadError("");
  }

  async function deleteGoal(item: Goal) {
    const response = await fetch(`/api/goals?id=${item.id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error((await response.json()).error);
    setGoals((current) =>
      current.filter((goalItem) => goalItem.id !== item.id),
    );
    setTasks((current) =>
      current.map((task) =>
        task.goal_id === item.id ? { ...task, goal_id: null } : task,
      ),
    );
    setGoal("all");
    setGoalDialog(null);
    setNotice("Goal deleted. Its tasks are now under No goal.");
  }

  async function confirmDeletion() {
    if (!pendingDeletion || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (pendingDeletion.kind === "task")
        await deleteTask(pendingDeletion.item);
      else await deleteGoal(pendingDeletion.item);
      setPendingDeletion(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "This item could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function changeGoalCompletion(
    item: Goal,
    completed: boolean,
    completeRemainingTasks = false,
  ) {
    if (busyGoalId) return;
    setBusyGoalId(item.id);
    setLoadError("");
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          completed,
          completeRemainingTasks,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The goal could not be updated.");
      const savedGoal = data.goal as Goal;
      const changedTasks = (data.tasks || []) as Task[];
      const changedById = new Map(
        changedTasks.map((changedTask) => [changedTask.id, changedTask]),
      );
      setGoals((current) =>
        current.map((goalItem) =>
          goalItem.id === savedGoal.id ? savedGoal : goalItem,
        ),
      );
      if (changedById.size)
        setTasks((current) =>
          current.map((task) => changedById.get(task.id) || task),
        );
      setGoalCompletionDialog(null);
      setNotice(
        completed
          ? completeRemainingTasks && changedTasks.length
            ? `Goal and ${changedTasks.length} remaining ${changedTasks.length === 1 ? "task" : "tasks"} completed.`
            : "Goal completed."
          : "Goal reopened. Its completed tasks remain completed.",
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The goal could not be updated.",
      );
      throw error;
    } finally {
      setBusyGoalId(null);
    }
  }

  async function requestGoalCompletion(item: Goal) {
    const hasIncompleteTasks = tasks.some(
      (task) => task.goal_id === item.id && task.status !== "completed",
    );
    if (hasIncompleteTasks) {
      setGoalCompletionDialog(item);
      return;
    }
    try {
      await changeGoalCompletion(item, true);
    } catch {
      // The visible page-level error is set by changeGoalCompletion.
    }
  }

  const shownGoals = goals.filter((item) => item.status === goalTab);
  const selectedTaskCount = tasks.filter((task) =>
    taskTab === "completed"
      ? task.status === "completed"
      : task.status !== "completed",
  ).length;
  const shown = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            (taskTab === "completed"
              ? task.status === "completed"
              : task.status !== "completed" &&
                (status === "all" || task.status === status)) &&
            (priority === "all" || task.priority === priority) &&
            (goal === "all" ||
              (goal === "none" ? !task.goal_id : task.goal_id === goal)) &&
            `${task.title} ${task.description || ""}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "due"
            ? (a.due_date || "9999").localeCompare(b.due_date || "9999")
            : sort === "priority"
              ? priorityWeight[b.priority] - priorityWeight[a.priority]
              : sort === "created"
                ? b.created_at.localeCompare(a.created_at)
                : b.updated_at.localeCompare(a.updated_at),
        ),
    [tasks, taskTab, status, priority, goal, search, sort],
  );

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Goals &amp; Tasks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Turn business goals into focused, manageable work.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setGoalDialog("new")}
            className="btn-secondary"
          >
            <GoalIcon className="size-4" />
            Create Goal
          </button>
          <button
            onClick={() => {
              setDefaultGoalId(goal !== "all" && goal !== "none" ? goal : null);
              setEditing("new");
            }}
            className="btn-primary"
          >
            <Plus className="size-4" />
            New task
          </button>
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {loadError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}
      <section className="mt-8" aria-labelledby="goals-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="goals-heading" className="text-lg font-semibold">
              Goals
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Outcomes are completed only when you explicitly confirm them.
            </p>
          </div>
          <CompletionTabs
            label="Goal completion"
            value={goalTab}
            onChange={setGoalTab}
            incompleteCount={
              goals.filter((item) => item.status === "incomplete").length
            }
            completedCount={
              goals.filter((item) => item.status === "completed").length
            }
          />
        </div>
        <div
          id={`goals-${goalTab}-panel`}
          role="tabpanel"
          aria-labelledby={`goals-${goalTab}-tab`}
          className="mt-4"
        >
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2].map((item) => (
                <div key={item} className="skeleton h-40" />
              ))}
            </div>
          ) : shownGoals.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {shownGoals.map((item) => {
                const assigned = tasks.filter(
                    (task) => task.goal_id === item.id,
                  ),
                  progress = goalProgress(assigned),
                  label = goalProgressLabel(assigned);
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "card p-4",
                      goal === item.id &&
                        "border-blue-300 ring-2 ring-blue-100",
                    )}
                  >
                    <button
                      onClick={() =>
                        setGoal(goal === item.id ? "all" : item.id)
                      }
                      className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <GoalIcon className="size-4 text-blue-600" />
                          {item.title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {assigned.length ? `${progress}%` : "—"}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                          {item.description}
                        </p>
                      )}
                      <div
                        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-label={`${item.title}: ${label}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{label}</p>
                      {item.completed_at && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Goal completed{" "}
                          {formatCompletionDate(item.completed_at)}
                        </p>
                      )}
                    </button>
                    <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs">
                      {item.status === "incomplete" && (
                        <button
                          className="font-medium text-blue-700 hover:underline"
                          onClick={() => {
                            setDefaultGoalId(item.id);
                            setEditing("new");
                          }}
                        >
                          Add task
                        </button>
                      )}
                      <button
                        className="text-slate-500 hover:underline"
                        onClick={() => setGoalDialog(item)}
                      >
                        Edit goal
                      </button>
                      {item.status === "incomplete" ? (
                        <button
                          className="ml-auto font-medium text-emerald-700 hover:underline disabled:opacity-50"
                          disabled={busyGoalId === item.id}
                          onClick={() => requestGoalCompletion(item)}
                        >
                          Mark Goal Complete
                        </button>
                      ) : (
                        <button
                          className="ml-auto flex items-center gap-1 font-medium text-blue-700 hover:underline disabled:opacity-50"
                          disabled={busyGoalId === item.id}
                          onClick={() =>
                            changeGoalCompletion(item, false).catch(() => {})
                          }
                        >
                          <RotateCcw className="size-3" /> Reopen Goal
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <GoalIcon className="mx-auto size-7 text-slate-300" />
              <p className="mt-2 text-sm font-medium">
                {goalTab === "completed"
                  ? "No completed goals"
                  : "No incomplete goals"}
              </p>
              {goalTab === "incomplete" && (
                <button
                  className="mt-2 text-sm font-semibold text-blue-700"
                  onClick={() => setGoalDialog("new")}
                >
                  Create your first goal
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      <section className="mt-10" aria-labelledby="tasks-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="tasks-heading" className="text-lg font-semibold">
              Tasks
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Track active work separately from completed history.
            </p>
          </div>
          <CompletionTabs
            label="Task completion"
            value={taskTab}
            onChange={setTaskTab}
            incompleteCount={
              tasks.filter((task) => task.status !== "completed").length
            }
            completedCount={
              tasks.filter((task) => task.status === "completed").length
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <span className="sr-only">Search tasks</span>
            <input
              className="field py-2 pl-9"
              placeholder="Search tasks…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {taskTab === "incomplete" && (
            <Filter
              value={status}
              onChange={setStatus}
              label="Status"
              options={[
                ["all", "All incomplete"],
                ["todo", "To do"],
                ["in_progress", "In progress"],
              ]}
            />
          )}
          <Filter
            value={priority}
            onChange={setPriority}
            label="Priority"
            options={[
              ["all", "All priorities"],
              ["na", "N/A"],
              ["low", "Low"],
              ["medium", "Medium"],
              ["high", "High"],
            ]}
          />
          <Filter
            value={goal}
            onChange={setGoal}
            label="Goal"
            options={[
              ["all", "All goals"],
              ["none", "No goal"],
              ...goals.map((item) => [item.id, item.title] as [string, string]),
            ]}
          />
          <Filter
            value={sort}
            onChange={setSort}
            label="Sort"
            options={[
              ["updated", "Recently updated"],
              ["due", "Due date"],
              ["priority", "Priority"],
              ["created", "Created date"],
            ]}
          />
        </div>
        <div
          id={`tasks-${taskTab}-panel`}
          role="tabpanel"
          aria-labelledby={`tasks-${taskTab}-tab`}
          className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : shown.length ? (
            <ul className="divide-y divide-slate-100">
              {shown.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  goal={goals.find((item) => item.id === task.goal_id)}
                  busy={busyTaskId === task.id}
                  onToggle={() => changeTaskCompletion(task)}
                  onEdit={() => setEditing(task)}
                />
              ))}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center">
              <Check className="mx-auto size-8 text-slate-300" />
              <h2 className="mt-3 font-semibold">
                {selectedTaskCount
                  ? "No tasks match these filters"
                  : taskTab === "completed"
                    ? "No completed tasks"
                    : "No incomplete tasks"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedTaskCount
                  ? "Try changing your search or filters."
                  : "Create a task or ask your consultant to build an action plan."}
              </p>
            </div>
          )}
        </div>
      </section>
      {editing && (
        <TaskDialog
          task={editing === "new" ? null : editing}
          goals={goals}
          defaultGoalId={defaultGoalId}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={
            editing === "new"
              ? undefined
              : () => {
                  setDeleteError("");
                  setPendingDeletion({ kind: "task", item: editing });
                }
          }
        />
      )}{" "}
      {goalDialog && (
        <GoalDialog
          goal={goalDialog === "new" ? null : goalDialog}
          onClose={() => setGoalDialog(null)}
          onSave={saveGoal}
          onDelete={
            goalDialog === "new"
              ? undefined
              : () => {
                  setDeleteError("");
                  setPendingDeletion({ kind: "goal", item: goalDialog });
                }
          }
        />
      )}
      {goalCompletionDialog && (
        <GoalCompletionDialog
          goal={goalCompletionDialog}
          incompleteTaskCount={
            tasks.filter(
              (task) =>
                task.goal_id === goalCompletionDialog.id &&
                task.status !== "completed",
            ).length
          }
          onClose={() => setGoalCompletionDialog(null)}
          onComplete={(completeRemainingTasks) =>
            changeGoalCompletion(
              goalCompletionDialog,
              true,
              completeRemainingTasks,
            )
          }
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingDeletion)}
        title={
          pendingDeletion?.kind === "goal" ? "Delete goal?" : "Delete task?"
        }
        description={
          pendingDeletion?.kind === "goal"
            ? `“${pendingDeletion.item.title}” will be permanently deleted. Its tasks will remain and move to No goal.`
            : `“${pendingDeletion?.item.title || "This task"}” will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={
          pendingDeletion?.kind === "goal" ? "Delete goal" : "Delete task"
        }
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setPendingDeletion(null);
          setDeleteError("");
        }}
        onConfirm={confirmDeletion}
      />
    </div>
  );
}

function CompletionTabs({
  label,
  value,
  onChange,
  incompleteCount,
  completedCount,
}: {
  label: string;
  value: CompletionTab;
  onChange: (value: CompletionTab) => void;
  incompleteCount: number;
  completedCount: number;
}) {
  const prefix = label.startsWith("Goal") ? "goals" : "tasks";
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
    >
      {(
        [
          ["incomplete", "Incomplete", incompleteCount],
          ["completed", "Completed", completedCount],
        ] as const
      ).map(([tab, text, count], index, allTabs) => (
        <button
          key={tab}
          id={`${prefix}-${tab}-tab`}
          type="button"
          role="tab"
          aria-selected={value === tab}
          aria-controls={`${prefix}-${tab}-panel`}
          tabIndex={value === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            const nextIndex =
              event.key === "ArrowRight"
                ? (index + 1) % allTabs.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + allTabs.length) % allTabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? allTabs.length - 1
                      : null;
            if (nextIndex === null) return;
            event.preventDefault();
            const nextTab = allTabs[nextIndex][0];
            onChange(nextTab);
            document.getElementById(`${prefix}-${nextTab}-tab`)?.focus();
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            value === tab
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:bg-white/70 hover:text-slate-900",
          )}
        >
          {text} <span className="ml-1 text-xs text-slate-400">{count}</span>
        </button>
      ))}
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: [string, string][];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        className="field appearance-none py-2 pr-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-400" />
    </label>
  );
}
function TaskRow({
  task,
  goal,
  busy,
  onToggle,
  onEdit,
}: {
  task: Task;
  goal?: Goal;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const overdue =
    task.due_date &&
    task.status !== "completed" &&
    task.due_date < new Date().toISOString().slice(0, 10);
  return (
    <li className="flex items-start gap-3 p-4 hover:bg-slate-50/70">
      {task.status === "completed" ? (
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-blue-600 bg-blue-600 text-white">
          <Check className="size-3" />
        </span>
      ) : (
        <button
          onClick={onToggle}
          disabled={busy}
          aria-label={`Mark task complete: ${task.title}`}
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-slate-300 bg-white hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3 animate-spin" />}
        </button>
      )}
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-sm font-medium",
            task.status === "completed" && "text-slate-400 line-through",
          )}
        >
          {task.title}
        </span>
        {task.description && (
          <span className="mt-1 block truncate text-xs text-slate-500">
            {task.description}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              task.priority === "high"
                ? "bg-red-50 text-red-700"
                : task.priority === "medium"
                  ? "bg-amber-50 text-amber-700"
                  : task.priority === "low"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100",
            )}
          >
            {task.priority === "na"
              ? "N/A"
              : task.priority[0].toUpperCase() + task.priority.slice(1)}{" "}
            priority
          </span>
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "font-semibold text-red-700",
              )}
            >
              <Calendar className="size-3" />
              {overdue ? "Overdue · " : ""}
              {task.due_date}
            </span>
          )}
          {goal && (
            <span className="flex items-center gap-1">
              <GoalIcon className="size-3" />
              {goal.title}
            </span>
          )}
          {task.origin === "ai" && <span>AI-generated</span>}
          {task.completed_at && (
            <span>Completed {formatCompletionDate(task.completed_at)}</span>
          )}
        </span>
      </button>
      {task.status === "completed" && (
        <button
          onClick={onToggle}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          aria-label={`Reopen task: ${task.title}`}
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RotateCcw className="size-3" />
          )}
          Reopen task
        </button>
      )}
      <button
        onClick={onEdit}
        className="p-2 text-slate-400 hover:text-slate-700"
        aria-label={`Edit ${task.title}`}
      >
        <MoreHorizontal className="size-4" />
      </button>
    </li>
  );
}

function GoalCompletionDialog({
  goal,
  incompleteTaskCount,
  onClose,
  onComplete,
}: {
  goal: Goal;
  incompleteTaskCount: number;
  onClose: () => void;
  onComplete: (completeRemainingTasks: boolean) => Promise<void>;
}) {
  const [busyChoice, setBusyChoice] = useState<"goal" | "all" | null>(null);
  const [error, setError] = useState("");

  async function complete(remainingTasks: boolean) {
    if (busyChoice) return;
    setBusyChoice(remainingTasks ? "all" : "goal");
    setError("");
    try {
      await onComplete(remainingTasks);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The goal could not be completed.",
      );
      setBusyChoice(null);
    }
  }

  return (
    <Dialog title="Complete goal" onClose={busyChoice ? () => {} : onClose}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-950">
              This goal still has incomplete tasks. How would you like to
              proceed?
            </p>
            <p className="mt-1 text-sm text-amber-800">
              “{goal.title}” has {incompleteTaskCount} incomplete{" "}
              {incompleteTaskCount === 1 ? "task" : "tasks"}.
            </p>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-3">
        <button
          className="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          disabled={Boolean(busyChoice)}
          onClick={() => complete(false)}
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            {busyChoice === "goal" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Complete goal only
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            Complete the goal while leaving its incomplete tasks unchanged and
            associated with it.
          </span>
        </button>
        <button
          className="w-full rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          disabled={Boolean(busyChoice)}
          onClick={() => complete(true)}
        >
          <span className="flex items-center gap-2 font-semibold text-blue-900">
            {busyChoice === "all" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Complete goal and remaining tasks
          </span>
          <span className="mt-1 block text-sm text-blue-800">
            Complete the goal and all {incompleteTaskCount} remaining tasks in
            one database operation.
          </span>
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          className="btn-secondary"
          disabled={Boolean(busyChoice)}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

function formatCompletionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
function TaskDialog({
  task,
  goals,
  defaultGoalId,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  goals: Goal[];
  defaultGoalId: string | null;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    title: string;
    description: string;
    dueDate: string;
    priority: Priority;
    status: TaskStatus;
    goalId: string | null;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
      id: task?.id,
      title: task?.title || "",
      description: task?.description || "",
      dueDate: task?.due_date || "",
      status: task?.status || ("todo" as TaskStatus),
      priority: task?.priority || ("na" as Priority),
      goalId: task?.goal_id || defaultGoalId,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ ...form, title: form.title.trim() });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The task could not be saved.",
      );
      setBusy(false);
    }
  }
  return (
    <Dialog title={task ? "Task details" : "Create a task"} onClose={onClose}>
      <div className="space-y-4">
        <label>
          <span className="label">Title *</span>
          <input
            autoFocus
            className="field"
            maxLength={160}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </label>
        <label>
          <span className="label">Description</span>
          <textarea
            className="field"
            rows={4}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Status</span>
            <select
              className="field"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as TaskStatus })
              }
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            <span className="label">Priority</span>
            <select
              className="field"
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as Priority })
              }
            >
              <option value="na">N/A</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            <span className="label">Due date</span>
            <input
              type="date"
              className="field"
              value={form.dueDate}
              onChange={(event) =>
                setForm({ ...form, dueDate: event.target.value })
              }
            />
          </label>
          <label>
            <span className="label">Goal</span>
            <select
              className="field"
              value={form.goalId || ""}
              onChange={(event) =>
                setForm({ ...form, goalId: event.target.value || null })
              }
            >
              <option value="">No goal</option>
              {goals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex items-center gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="btn-ghost mr-auto text-red-700"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        )}
        <button onClick={onClose} disabled={busy} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!form.title.trim() || busy}
          className="btn-primary"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}Save task
        </button>
      </div>
    </Dialog>
  );
}
function GoalDialog({
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    title: string;
    description: string;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(goal?.title || ""),
    [description, setDescription] = useState(goal?.description || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ id: goal?.id, title: title.trim(), description });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The goal could not be saved.",
      );
      setBusy(false);
    }
  }
  return (
    <Dialog title={goal ? "Edit goal" : "Create a goal"} onClose={onClose}>
      <div className="space-y-4">
        <label>
          <span className="label">Title *</span>
          <input
            autoFocus
            className="field"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Description</span>
          <textarea
            className="field"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        {onDelete && (
          <button
            className="btn-ghost mr-auto text-red-700"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Delete goal
          </button>
        )}
        <button className="btn-secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={!title.trim() || busy}
          onClick={submit}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}Save goal
        </button>
      </div>
    </Dialog>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="card relative z-10 w-full max-w-xl p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onClose} className="p-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
