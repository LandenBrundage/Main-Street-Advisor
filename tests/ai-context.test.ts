import { describe, expect, it, vi } from "vitest";
import { buildBusinessContext } from "@/lib/ai/context";
import { requestConsultantResponse } from "@/lib/ai/respond";
import { fallbackTitle } from "@/lib/ai/title";

describe("AI context and request construction", () => {
  it("includes populated saved profile fields and excludes empty/internal fields", () => {
    const context = buildBusinessContext({
      name: "Northstar Coffee",
      industry: "Coffee shop",
      employee_count: 8,
      target_customers: "Remote workers",
      fixed_costs: "Rent",
      financial_notes: "",
      vector_store_id: "secret-internal-id",
    });
    expect(context).toContain("Business name: Northstar Coffee");
    expect(context).toContain("Employees: 8");
    expect(context).toContain("Target customers: Remote workers");
    expect(context).toContain("Major fixed costs: Rent");
    expect(context).not.toContain("vector_store_id");
    expect(context).not.toContain("secret-internal-id");
  });

  it("sends different user questions as different Responses API inputs", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ output: [], output_text: "answer" });
    const openai = { responses: { create } } as never;
    await requestConsultantResponse({
      openai,
      model: "test-model",
      context: "Business name: Test",
      messages: [{ role: "user", content: "Increase coffee sales" }],
    });
    await requestConsultantResponse({
      openai,
      model: "test-model",
      context: "Business name: Test",
      messages: [{ role: "user", content: "Reduce landscaping fuel costs" }],
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].input).toEqual([
      { role: "user", content: "Increase coffee sales" },
    ]);
    expect(create.mock.calls[1][0].input).toEqual([
      { role: "user", content: "Reduce landscaping fuel costs" },
    ]);
    expect(create.mock.calls[0][0].instructions).toContain(
      "Business name: Test",
    );
  });

  it("executes an approved retrieval tool and returns its output to the model", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: "",
        output: [
          {
            type: "function_call",
            name: "list_tasks",
            call_id: "call_tasks",
            arguments: JSON.stringify({
              goalId: null,
              status: "in_progress",
              priority: null,
              dueBefore: null,
              dueAfter: null,
              limit: 10,
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        output: [],
        output_text: "Your measurement task is still in progress.",
      });
    const executeRetrieval = vi
      .fn()
      .mockResolvedValue([
        { title: "Measure sales by hour", status: "in_progress" },
      ]);

    const result = await requestConsultantResponse({
      openai: { responses: { create } } as never,
      model: "test-model",
      context: "Compact business snapshot: Northstar Coffee",
      messages: [{ role: "user", content: "What is still open?" }],
      executeRetrieval,
    });

    expect(executeRetrieval).toHaveBeenCalledWith(
      "list_tasks",
      expect.stringContaining('"status":"in_progress"'),
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].input).toContainEqual(
      expect.objectContaining({
        type: "function_call_output",
        call_id: "call_tasks",
        output: expect.stringContaining("Measure sales by hour"),
      }),
    );
    expect(result.output_text).toContain("still in progress");
  });
});

describe("conversation title fallback", () => {
  it("creates a stable concise title without losing the conversation", () => {
    expect(
      fallbackTitle(
        "How can I increase sales on quiet weekday afternoons at my coffee shop?",
      ),
    ).toBe("How can I increase sales on quiet…");
  });
});
