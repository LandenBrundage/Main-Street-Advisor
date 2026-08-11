import { describe, expect, it } from "vitest";
import {
  goalProgress,
  goalProgressLabel,
  isDuplicateProposal,
} from "@/lib/domain";
describe("goal progress", () => {
  it("calculates completed task percentage", () =>
    expect(
      goalProgress([
        { status: "completed" },
        { status: "todo" },
        { status: "completed" },
      ] as never),
    ).toBe(67));
  it("returns zero for no tasks", () => expect(goalProgress([])).toBe(0));
});
describe("proposal idempotency", () => {
  it("blocks pending and approved duplicate execution", () => {
    expect(
      isDuplicateProposal(
        [{ idempotency_key: "abc", status: "approved" }],
        "abc",
      ),
    ).toBe(true);
    expect(
      isDuplicateProposal(
        [{ idempotency_key: "abc", status: "failed" }],
        "abc",
      ),
    ).toBe(false);
  });
});
describe("empty goal accessibility", () => {
  it("reports no assigned tasks instead of completion", () =>
    expect(goalProgressLabel([])).toBe("No tasks assigned"));
});
