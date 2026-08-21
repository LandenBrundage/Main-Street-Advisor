import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAIContext } from "@/lib/ai/context-builder";
import { runDemoAIConsultation } from "@/lib/ai/demo-consultation";
import { createDemoContextSource } from "@/lib/ai/demo-runtime";
import {
  approveDemoCompletionRequest,
  approveDemoProposal,
  getDemoAIData,
  getDemoProfile,
  listDemoConversations,
  listDemoDocuments,
  resetDemoState,
} from "@/lib/demo-store";
import { profileCompletion } from "@/lib/profile";

const cleanModeration = {
  input: { type: "moderation_result", flagged: false, categories: {} },
  output: { type: "moderation_result", flagged: false, categories: {} },
};

beforeEach(() => resetDemoState());

describe("fictional customer demo", () => {
  it("starts with a complete business profile and compact document-backed context", async () => {
    const profile = getDemoProfile();
    expect(profile.businessName).toBe("Sunrise Bakery & Café");
    expect(profileCompletion(profile)).toBe(100);
    expect(profile.offerings.main).toContain("Corporate catering trays");
    expect(profile.goals.triedStrategies).toHaveLength(2);
    expect(profile).not.toHaveProperty("name");

    const conversation = listDemoConversations()[0];
    const context = await buildAIContext({
      source: createDemoContextSource(),
      conversationId: conversation.id,
    });
    expect(context.instructionsContext).toContain("Sunrise Bakery & Café");
    expect(context.instructionsContext).toContain(
      "Increase weekday afternoon revenue by 15%",
    );
    expect(context.instructionsContext).toContain("Q2 daypart sales.csv");
    expect(context.instructionsContext).toContain("34 transactions");
    expect(context.instructionsContext).not.toContain("Maya Chen");
    expect(context.diagnostics.previousSummaryCount).toBe(2);

    const documents = listDemoDocuments();
    expect(documents).toHaveLength(2);
    expect(documents[0]).not.toHaveProperty("extracted_text");
  });

  it("sends the actual demo question and fictional business context through the Responses API", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output: [],
        moderation: cleanModeration,
        output_text:
          "Use a margin-safe afternoon bundle and target morning regulars first.",
      })
      .mockResolvedValueOnce({
        output: [],
        output_text: "Afternoon Revenue Strategy",
        moderation: cleanModeration,
      });
    const question =
      "What should this bakery test next to improve afternoon revenue?";
    const result = await runDemoAIConsultation({
      openai: { responses: { create } } as never,
      model: "test-model",
      message: question,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].input).toContainEqual({
      role: "user",
      content: question,
    });
    expect(create.mock.calls[0][0].instructions).toContain(
      "Sunrise Bakery & Café",
    );
    expect(create.mock.calls[0][0].instructions).toContain(
      "blanket 10% discount",
    );
    expect(create.mock.calls[0][0].instructions).not.toContain("Maya Chen");
    expect(result.message.content).toContain("margin-safe afternoon bundle");
    expect(result.title).toBe("Afternoon Revenue Strategy");
    expect(
      listDemoConversations().some(
        (conversation) => conversation.id === result.conversationId,
      ),
    ).toBe(true);
  });

  it("keeps real-AI task plans behind the existing Add Tasks approval", async () => {
    const plan = {
      goal: {
        title: "Improve Afternoon Revenue",
        description: "Test a focused offer without reducing margin.",
        targetDate: null,
      },
      tasks: [
        {
          title: "Price one margin-safe bundle",
          description: "Calculate contribution margin before launch.",
          dueDate: null,
          priority: "high",
          order: 0,
        },
      ],
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: "",
        moderation: cleanModeration,
        output: [
          {
            type: "function_call",
            name: "create_task_plan",
            call_id: "demo-plan-call",
            arguments: JSON.stringify(plan),
          },
        ],
      })
      .mockResolvedValueOnce({
        output: [],
        moderation: cleanModeration,
        output_text:
          "I prepared the requested task for your approval; nothing has been saved yet.",
      })
      .mockResolvedValueOnce({
        output: [],
        output_text: "Afternoon Bundle Plan",
        moderation: cleanModeration,
      });

    const before = getDemoAIData().tasks.length;
    const result = await runDemoAIConsultation({
      openai: { responses: { create } } as never,
      model: "test-model",
      message: "Create and save a task plan for an afternoon bundle.",
    });
    expect(result.proposal?.tasks).toHaveLength(1);
    expect(getDemoAIData().tasks).toHaveLength(before);

    const approved = approveDemoProposal(result.proposal!.id);
    expect(approved?.tasks).toHaveLength(1);
    expect(getDemoAIData().tasks).toHaveLength(before + 1);
  });

  it("requires approval before a chat-proposed task completion is persisted", async () => {
    const task = getDemoAIData().tasks.find(
      (item) => item.status === "in_progress",
    )!;
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        output_text: "",
        moderation: cleanModeration,
        output: [
          {
            type: "function_call",
            name: "propose_task_completion",
            call_id: "demo-completion-call",
            arguments: JSON.stringify({
              taskId: task.id,
              confirmationText:
                "Confirm that “" + task.title + "” is complete.",
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        output: [],
        moderation: cleanModeration,
        output_text:
          "I prepared a confirmation action. The task has not changed yet.",
      })
      .mockResolvedValueOnce({
        output: [],
        output_text: "Task Completion",
        moderation: cleanModeration,
      });
    const result = await runDemoAIConsultation({
      openai: { responses: { create } } as never,
      model: "test-model",
      message: "I finished " + task.title + ".",
    });

    expect(
      getDemoAIData().tasks.find((item) => item.id === task.id)?.status,
    ).toBe("in_progress");
    const approved = approveDemoCompletionRequest(
      result.completionProposal!.id,
    );
    expect(approved?.task.status).toBe("completed");
    expect(
      getDemoAIData().tasks.find((item) => item.id === task.id)?.completed_at,
    ).toBeTruthy();
  });
});
