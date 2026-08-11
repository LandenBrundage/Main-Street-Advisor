// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskManager } from "@/components/tasks/task-manager";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe("persisted task and goal management", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("creates a goal and a manual task through server APIs and displays both immediately", async () => {
    const goal = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Improve retention",
      description: null,
      target_date: null,
      status: "incomplete",
      completed_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const task = {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Interview customers",
      description: null,
      due_date: null,
      priority: "medium",
      status: "todo",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal.id,
      origin: "manual",
      sort_order: 0,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, options?: RequestInit) => {
        if (url === "/api/tasks" && !options?.method)
          return jsonResponse({ tasks: [], goals: [] });
        if (url === "/api/goals") return jsonResponse({ goal });
        if (url === "/api/tasks" && options?.method === "POST")
          return jsonResponse({ task });
        throw new Error(`Unexpected request: ${url}`);
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskManager />);
    await screen.findByText("No incomplete tasks");
    fireEvent.click(screen.getByRole("button", { name: "Create Goal" }));
    const goalDialog = screen.getByRole("dialog", { name: "Create a goal" });
    fireEvent.change(within(goalDialog).getByLabelText("Title *"), {
      target: { value: "Improve retention" },
    });
    fireEvent.click(
      within(goalDialog).getByRole("button", { name: "Save goal" }),
    );
    await screen.findByRole("progressbar", {
      name: "Improve retention: No tasks assigned",
    });
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const taskDialog = screen.getByRole("dialog", { name: "Create a task" });
    fireEvent.change(within(taskDialog).getByLabelText("Title *"), {
      target: { value: "Interview customers" },
    });
    fireEvent.change(within(taskDialog).getByLabelText("Priority"), {
      target: { value: "medium" },
    });
    fireEvent.change(within(taskDialog).getByLabelText("Goal"), {
      target: { value: goal.id },
    });
    fireEvent.click(
      within(taskDialog).getByRole("button", { name: "Save task" }),
    );
    await screen.findByText("Interview customers");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(goal.id),
      }),
    );
  });

  it("keeps the task form open and shows the database error after a failed insertion", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string, options?: RequestInit) =>
          url === "/api/tasks" && !options?.method
            ? jsonResponse({ tasks: [], goals: [] })
            : jsonResponse({ error: "Database insertion failed." }, false),
        ),
    );
    render(<TaskManager />);
    await screen.findByText("No incomplete tasks");
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const dialog = screen.getByRole("dialog", { name: "Create a task" });
    fireEvent.change(within(dialog).getByLabelText("Title *"), {
      target: { value: "Persist me" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save task" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "Database insertion failed.",
      ),
    );
    expect(screen.getByRole("dialog", { name: "Create a task" })).toBeTruthy();
  });

  it("moves a completed task between tabs and restores its previous incomplete status", async () => {
    const goal = testGoal();
    const activeTask = testTask({
      status: "in_progress",
      goal_id: goal.id,
    });
    const completedTask = {
      ...activeTask,
      status: "completed",
      completed_at: "2026-07-14T12:00:00Z",
      previous_incomplete_status: "in_progress",
      updated_at: "2026-07-14T12:00:00Z",
    };
    const reopenedTask = {
      ...completedTask,
      status: "in_progress",
      completed_at: null,
      updated_at: "2026-07-14T12:05:00Z",
    };
    const updates: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url === "/api/tasks" && !options?.method)
          return jsonResponse({ tasks: [activeTask], goals: [goal] });
        if (url === "/api/tasks" && options?.method === "PATCH") {
          const body = JSON.parse(String(options.body));
          updates.push(body);
          return jsonResponse({
            task: body.status === "completed" ? completedTask : reopenedTask,
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<TaskManager />);
    await screen.findByText(activeTask.title);
    const taskTabs = screen.getByRole("tablist", { name: "Task completion" });
    expect(
      within(taskTabs)
        .getByRole("tab", { name: /Incomplete/ })
        .getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.click(
      screen.getByRole("button", {
        name: `Mark task complete: ${activeTask.title}`,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText(activeTask.title)).toBeNull(),
    );
    fireEvent.click(within(taskTabs).getByRole("tab", { name: /Completed/ }));
    await screen.findByText(activeTask.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Reopen task: ${activeTask.title}` }),
    );
    await waitFor(() =>
      expect(screen.queryByText(activeTask.title)).toBeNull(),
    );
    fireEvent.click(within(taskTabs).getByRole("tab", { name: /Incomplete/ }));
    await screen.findByText(activeTask.title);

    expect(updates.map((update) => update.status)).toEqual([
      "completed",
      "in_progress",
    ]);
  });

  it("offers all three goal choices, completes only the goal, and reopens it without changing tasks", async () => {
    const goal = testGoal();
    const task = testTask({ goal_id: goal.id });
    const completedGoal = {
      ...goal,
      status: "completed",
      completed_at: "2026-07-14T12:00:00Z",
      updated_at: "2026-07-14T12:00:00Z",
    };
    const reopenedGoal = {
      ...goal,
      status: "incomplete",
      completed_at: null,
      updated_at: "2026-07-14T12:05:00Z",
    };
    const goalUpdates: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url === "/api/tasks" && !options?.method)
          return jsonResponse({ tasks: [task], goals: [goal] });
        if (url === "/api/goals" && options?.method === "PUT") {
          const body = JSON.parse(String(options.body));
          goalUpdates.push(body);
          return jsonResponse({
            goal: body.completed ? completedGoal : reopenedGoal,
            tasks: [],
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<TaskManager />);
    await screen.findByRole("progressbar", {
      name: `${goal.title}: 0 of 1 tasks completed`,
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark Goal Complete" }));
    const dialog = screen.getByRole("dialog", { name: "Complete goal" });
    expect(
      within(dialog).getByText(
        "This goal still has incomplete tasks. How would you like to proceed?",
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /Complete goal only/ }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", {
        name: /Complete goal and remaining tasks/,
      }),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(goalUpdates).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Mark Goal Complete" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Complete goal" })).getByRole(
        "button",
        { name: /Complete goal only/ },
      ),
    );
    await screen.findByText("Goal completed.");
    expect(screen.getByText(task.title)).toBeTruthy();

    const goalTabs = screen.getByRole("tablist", { name: "Goal completion" });
    fireEvent.click(within(goalTabs).getByRole("tab", { name: /Completed/ }));
    await screen.findByRole("button", { name: "Reopen Goal" });
    fireEvent.click(screen.getByRole("button", { name: "Reopen Goal" }));
    await screen.findByText(
      "Goal reopened. Its completed tasks remain completed.",
    );
    fireEvent.click(within(goalTabs).getByRole("tab", { name: /Incomplete/ }));
    await screen.findByRole("progressbar", {
      name: `${goal.title}: 0 of 1 tasks completed`,
    });

    expect(goalUpdates).toEqual([
      {
        id: goal.id,
        completed: true,
        completeRemainingTasks: false,
      },
      {
        id: goal.id,
        completed: false,
        completeRemainingTasks: false,
      },
    ]);
    expect(task.status).toBe("todo");
  });

  it("moves a goal and its remaining tasks to Completed after the bulk choice", async () => {
    const goal = testGoal();
    const incompleteTask = testTask({ goal_id: goal.id });
    const existingCompletedTask = testTask({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Already complete",
      goal_id: goal.id,
      status: "completed",
      completed_at: "2026-07-13T12:00:00Z",
      previous_incomplete_status: "todo",
    });
    const newlyCompletedTask = {
      ...incompleteTask,
      status: "completed",
      completed_at: "2026-07-14T12:00:00Z",
      previous_incomplete_status: "todo",
    };
    const completedGoal = {
      ...goal,
      status: "completed",
      completed_at: "2026-07-14T12:00:00Z",
    };
    let completionBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url === "/api/tasks" && !options?.method)
          return jsonResponse({
            tasks: [incompleteTask, existingCompletedTask],
            goals: [goal],
          });
        if (url === "/api/goals" && options?.method === "PUT") {
          completionBody = JSON.parse(String(options.body));
          return jsonResponse({
            goal: completedGoal,
            tasks: [newlyCompletedTask],
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<TaskManager />);
    await screen.findByText(incompleteTask.title);
    fireEvent.click(screen.getByRole("button", { name: "Mark Goal Complete" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Complete goal" })).getByRole(
        "button",
        { name: /Complete goal and remaining tasks/ },
      ),
    );
    await screen.findByText("Goal and 1 remaining task completed.");
    expect(screen.queryByText(incompleteTask.title)).toBeNull();

    const taskTabs = screen.getByRole("tablist", { name: "Task completion" });
    fireEvent.click(within(taskTabs).getByRole("tab", { name: /Completed/ }));
    expect(await screen.findByText(incompleteTask.title)).toBeTruthy();
    expect(screen.getByText(existingCompletedTask.title)).toBeTruthy();
    expect(completionBody).toEqual({
      id: goal.id,
      completed: true,
      completeRemainingTasks: true,
    });
  });

  it("completes a goal immediately when all related tasks are already complete", async () => {
    const goal = testGoal();
    const task = testTask({
      goal_id: goal.id,
      status: "completed",
      completed_at: "2026-07-13T12:00:00Z",
      previous_incomplete_status: "todo",
    });
    const completedGoal = {
      ...goal,
      status: "completed",
      completed_at: "2026-07-14T12:00:00Z",
    };
    const update = vi.fn(() =>
      jsonResponse({ goal: completedGoal, tasks: [] }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url === "/api/tasks" && !options?.method)
          return jsonResponse({ tasks: [task], goals: [goal] });
        if (url === "/api/goals" && options?.method === "PUT") return update();
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<TaskManager />);
    await screen.findByRole("progressbar", {
      name: `${goal.title}: 1 of 1 tasks completed`,
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark Goal Complete" }));
    await screen.findByText("Goal completed.");
    expect(screen.queryByRole("dialog", { name: "Complete goal" })).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

function testGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Improve retention",
    description: null,
    target_date: null,
    status: "incomplete",
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function testTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Interview customers",
    description: null,
    due_date: null,
    priority: "medium",
    status: "todo",
    completed_at: null,
    previous_incomplete_status: null,
    goal_id: null,
    origin: "manual",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
