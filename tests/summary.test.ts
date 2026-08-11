import { describe, expect, it } from "vitest";
import { selectSummaryBatch } from "@/lib/ai/summary";

const messages = Array.from({ length: 30 }, (_, index) => ({
  id: `message-${index + 1}`,
  role: index % 2 ? ("assistant" as const) : ("user" as const),
  content: `Message ${index + 1}`,
  created_at: new Date(2026, 0, index + 1).toISOString(),
}));

describe("rolling summary boundaries", () => {
  it("does not summarize at or below the configured trigger", () => {
    expect(
      selectSummaryBatch({
        messages: messages.slice(0, 24),
        triggerMessages: 24,
        recentMessageLimit: 12,
        batchSize: 20,
      }),
    ).toEqual([]);
  });

  it("summarizes only the oldest eligible segment and preserves recent messages", () => {
    const batch = selectSummaryBatch({
      messages,
      triggerMessages: 24,
      recentMessageLimit: 12,
      batchSize: 8,
    });
    expect(batch).toHaveLength(8);
    expect(batch[0].id).toBe("message-1");
    expect(batch.at(-1)?.id).toBe("message-8");
    expect(messages.slice(-12).map((message) => message.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `message-${index + 19}`),
    );
  });
});
