import { describe, expect, it } from "vitest";
import {
  prioritySchema,
  statusSchema,
  taskPlanSchema,
  taskSchema,
} from "@/lib/schemas";
describe("task validation", () => {
  it("accepts a complete task", () =>
    expect(
      taskSchema.safeParse({
        title: "Call supplier",
        priority: "high",
        status: "todo",
      }).success,
    ).toBe(true));
  it("rejects blank titles", () =>
    expect(
      taskSchema.safeParse({ title: "", priority: "low", status: "todo" })
        .success,
    ).toBe(false));
  it("validates priorities and statuses", () => {
    expect(prioritySchema.safeParse("urgent").success).toBe(false);
    expect(statusSchema.safeParse("blocked").success).toBe(false);
  });
});
describe("AI task plan validation", () => {
  it("accepts strict structured plans", () =>
    expect(
      taskPlanSchema.safeParse({
        goal: { title: "Grow" },
        tasks: [{ title: "Test", priority: "medium", order: 0 }],
      }).success,
    ).toBe(true));
  it("rejects empty plans and invalid dates", () =>
    expect(
      taskPlanSchema.safeParse({ goal: { title: "Grow" }, tasks: [] }).success,
    ).toBe(false));
});
