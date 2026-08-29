import { describe, expect, it, vi } from "vitest";
import { buildBusinessContext } from "@/lib/ai/context";
import { buildAIContext, type ContextSource } from "@/lib/ai/context-builder";
import { requestConsultantResponse } from "@/lib/ai/respond";
import { fallbackTitle } from "@/lib/ai/title";

const cleanModeration = {
  input: { type: "moderation_result", flagged: false, categories: {} },
  output: { type: "moderation_result", flagged: false, categories: {} },
};

describe("AI context and request construction", () => {
  it("does not retrieve or infer workspace records when workspace context is disabled", async () => {
    const source = {
      getBusinessSnapshot: vi.fn(),
      getPrimaryGoal: vi.fn(),
      getActiveTasks: vi.fn(),
      getRecentCompletedItems: vi.fn(),
      getCurrentConversationMemory: vi.fn().mockResolvedValue({
        summary: null,
        messages: [],
      }),
      getPreviousConversationSummaries: vi.fn(),
    } satisfies ContextSource;

    const context = await buildAIContext({
      source,
      conversationId: "privacy-test-conversation",
      privacySettings: {
        workspaceContextEnabled: false,
        crossConversationEnabled: false,
        documentSearchEnabled: false,
      },
    });

    expect(source.getBusinessSnapshot).not.toHaveBeenCalled();
    expect(source.getPrimaryGoal).not.toHaveBeenCalled();
    expect(source.getActiveTasks).not.toHaveBeenCalled();
    expect(source.getRecentCompletedItems).not.toHaveBeenCalled();
    expect(source.getPreviousConversationSummaries).not.toHaveBeenCalled();
    expect(context.instructionsContext).toContain(
      "Workspace context is disabled. You have no access",
    );
    expect(context.instructionsContext).not.toContain(
      "Current primary goal: none",
    );
    expect(context.instructionsContext).not.toContain(
      "Relevant active tasks: none",
    );
    expect(context.instructionsContext).not.toContain(
      "Recently completed work: none",
    );
  });

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
    const create = vi.fn().mockResolvedValue({
      output: [],
      output_text: "answer",
      moderation: cleanModeration,
    });
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
    expect(create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        store: false,
        safety_identifier: "local-test-safety-id",
        max_output_tokens: 3000,
        moderation: expect.objectContaining({
          model: "omni-moderation-latest",
        }),
      }),
    );
  });

  it("removes action tools when moderation marks a request for answer-only handling", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [],
      output_text: "I can discuss this safely without creating actions.",
      moderation: cleanModeration,
    });
    await requestConsultantResponse({
      openai: { responses: { create } } as never,
      model: "test-model",
      context: "Current workspace",
      messages: [{ role: "user", content: "Sensitive workplace discussion" }],
      allowActionTools: false,
    });
    const names = create.mock.calls[0][0].tools.flatMap(
      (tool: { name?: string }) => (tool.name ? [tool.name] : []),
    );
    expect(names).not.toContain("create_task_plan");
    expect(names).not.toContain("propose_task_completion");
    expect(names).not.toContain("suggest_task_plan");
  });

  it("records an actionable-response signal without creating application data", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: "",
        moderation: cleanModeration,
        output: [
          {
            type: "function_call",
            name: "suggest_task_plan",
            call_id: "call_suggestion",
            arguments: JSON.stringify({
              reason: "The response contains a concrete three-step test.",
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        output: [],
        output_text: "Measure demand, run one offer, and compare the results.",
        moderation: cleanModeration,
      });

    const result = await requestConsultantResponse({
      openai: { responses: { create } } as never,
      model: "test-model",
      context: "Compact business snapshot",
      messages: [{ role: "user", content: "How should I test demand?" }],
    });

    expect(result.actionCalls).toEqual([
      expect.objectContaining({
        callId: "call_suggestion",
        name: "suggest_task_plan",
      }),
    ]);
    expect(create.mock.calls[1][0].input).toContainEqual(
      expect.objectContaining({
        type: "function_call_output",
        call_id: "call_suggestion",
        output: expect.stringContaining("suggestion_control_available"),
      }),
    );
  });

  it("executes an approved retrieval tool and returns its output to the model", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: "",
        moderation: cleanModeration,
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
        moderation: cleanModeration,
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
