import { describe, expect, it, vi } from "vitest";
import {
  buildAIContext,
  selectRecentCompletedItems,
  type ContextSource,
} from "@/lib/ai/context-builder";

const summary = {
  confirmedFacts: ["Weekday afternoons are slow"],
  decisions: [],
  goalsAndConstraints: ["Budget is $300"],
  recommendedStrategies: ["Test a bundled offer"],
  confirmedActionsTried: [],
  confirmedResults: [],
  unresolvedQuestions: ["Which hours are slowest?"],
};

describe("bounded AI context", () => {
  it("combines the compact profile, authoritative work state, summaries, and bounded recent messages", async () => {
    const getCurrentConversationMemory = vi.fn().mockResolvedValue({
      summary,
      messages: [
        {
          id: "m2",
          role: "assistant",
          content: "Which weekday is slowest?",
          created_at: "2026-07-13T01:00:00Z",
        },
        {
          id: "m3",
          role: "user",
          content: "Tuesday is slowest.",
          created_at: "2026-07-13T01:01:00Z",
        },
      ],
    });
    const source: ContextSource = {
      getBusinessSnapshot: vi.fn().mockResolvedValue({
        identity: { name: "Northstar Coffee", industry: "Coffee shop" },
        market: { idealCustomer: "Remote workers" },
      }),
      getPrimaryGoal: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Increase weekday sales",
        description: null,
        target_date: null,
        status: "incomplete",
        completed_at: null,
      }),
      getActiveTasks: vi.fn().mockResolvedValue([
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Measure sales by hour",
          status: "in_progress",
          priority: "high",
          due_date: null,
          goal_id: "11111111-1111-4111-8111-111111111111",
        },
      ]),
      getCurrentConversationMemory,
      getPreviousConversationSummaries: vi.fn().mockResolvedValue([
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Customer Retention",
          updated_at: "2026-07-12T01:00:00Z",
          summary,
        },
      ]),
      getRecentCompletedItems: vi.fn().mockResolvedValue([
        {
          type: "task",
          title: "Test a weekday bundle",
          completedAt: "2026-07-13T00:00:00Z",
          associatedGoal: "Increase weekday sales",
        },
      ]),
    };

    const context = await buildAIContext({
      source,
      conversationId: "44444444-4444-4444-8444-444444444444",
      recentMessageLimit: 2,
      previousSummaryLimit: 1,
    });

    expect(getCurrentConversationMemory).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      2,
    );
    expect(source.getPreviousConversationSummaries).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      1,
    );
    expect(context.instructionsContext).toContain("Northstar Coffee");
    expect(context.instructionsContext).toContain("Remote workers");
    expect(context.instructionsContext).toContain("in_progress");
    expect(context.instructionsContext).toContain("confirmedFacts");
    expect(context.instructionsContext).toContain("Test a weekday bundle");
    expect(context.messages).toEqual([
      { role: "assistant", content: "Which weekday is slowest?" },
      { role: "user", content: "Tuesday is slowest." },
    ]);
    expect(context.diagnostics).toEqual({
      recentMessageCount: 2,
      previousSummaryCount: 1,
      activeTaskCount: 1,
      recentCompletedCount: 1,
      hasCurrentSummary: true,
    });
  });

  it("includes a bounded excerpt when a previous consultation is too short to summarize", async () => {
    const source: ContextSource = {
      getBusinessSnapshot: vi.fn().mockResolvedValue({}),
      getPrimaryGoal: vi.fn().mockResolvedValue(null),
      getActiveTasks: vi.fn().mockResolvedValue([]),
      getCurrentConversationMemory: vi.fn().mockResolvedValue({
        summary: null,
        messages: [],
      }),
      getPreviousConversationSummaries: vi.fn().mockResolvedValue([
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Privacy test",
          updated_at: "2026-08-26T12:00:00Z",
          summary: null,
          recentMessages: [
            {
              role: "user",
              content: "The fictional code phrase is CEDAR-LANTERN-6419.",
            },
            { role: "assistant", content: "Acknowledged." },
          ],
        },
      ]),
      getRecentCompletedItems: vi.fn().mockResolvedValue([]),
    };

    const context = await buildAIContext({
      source,
      conversationId: "44444444-4444-4444-8444-444444444444",
      privacySettings: {
        workspaceContextEnabled: false,
        crossConversationEnabled: true,
        documentSearchEnabled: false,
      },
    });

    expect(context.instructionsContext).toContain("bounded excerpts");
    expect(context.instructionsContext).toContain("CEDAR-LANTERN-6419");
  });

  it("keeps only the ten most recently completed items", () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      type: index % 2 ? ("goal" as const) : ("task" as const),
      title: `Completed item ${index + 1}`,
      completedAt: new Date(Date.UTC(2026, 6, index + 1)).toISOString(),
    }));
    const selected = selectRecentCompletedItems(items, 50);
    expect(selected).toHaveLength(10);
    expect(selected[0].title).toBe("Completed item 12");
    expect(selected.at(-1)?.title).toBe("Completed item 3");
    expect(selected.some((item) => item.title === "Completed item 1")).toBe(
      false,
    );
  });
});
