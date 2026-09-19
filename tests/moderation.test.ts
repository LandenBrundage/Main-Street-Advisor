import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  enforceResponseModeration,
  moderateUserMessage,
  ModerationBlockedError,
  ModerationUnavailableError,
} from "@/lib/ai/moderation";
import { requestConsultantResponse } from "@/lib/ai/respond";

function responseWith({
  input = {},
  output = {},
  outputText = "Safe response",
}: {
  input?: Record<string, boolean>;
  output?: Record<string, boolean>;
  outputText?: string;
} = {}) {
  return {
    output: [],
    output_text: outputText,
    moderation: {
      input: {
        type: "moderation_result",
        flagged: Object.values(input).some(Boolean),
        categories: input,
      },
      output: {
        type: "moderation_result",
        flagged: Object.values(output).some(Boolean),
        categories: output,
      },
    },
  } as unknown as OpenAI.Responses.Response;
}

describe("balanced moderation policy", () => {
  it("blocks severe input but allows a supportive self-harm-intent discussion", async () => {
    const openai = {} as OpenAI;
    await expect(
      enforceResponseModeration(
        openai,
        responseWith({ input: { "illicit/violent": true } }),
        { input: "input", output: "output" },
      ),
    ).rejects.toThrow(ModerationBlockedError);
    await expect(
      enforceResponseModeration(
        openai,
        responseWith({ input: { "self-harm/intent": true } }),
        { input: "input", output: "output" },
      ),
    ).resolves.toEqual({ inputFlagged: true });
  });

  it("withholds unsafe output", async () => {
    await expect(
      enforceResponseModeration(
        {} as OpenAI,
        responseWith({ output: { harassment: true } }),
        { input: "input", output: "output" },
      ),
    ).rejects.toThrow(ModerationBlockedError);
  });

  it("uses standalone moderation when inline response scores are unavailable", async () => {
    const create = vi.fn().mockResolvedValue({
      results: [
        { flagged: false, categories: {} },
        { flagged: false, categories: {} },
      ],
    });
    const result = await enforceResponseModeration(
      { moderations: { create } } as never,
      { moderation: null } as OpenAI.Responses.Response,
      { input: "legitimate business question", output: "safe answer" },
    );
    expect(result).toEqual({ inputFlagged: false });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: ["legitimate business question", "safe answer"],
      }),
      { maxRetries: 0 },
    );
  });

  it("applies the blocking policy to standalone fallback results", async () => {
    const create = vi.fn().mockResolvedValue({
      results: [
        { flagged: false, categories: {} },
        { flagged: true, categories: { harassment: true } },
      ],
    });
    await expect(
      enforceResponseModeration(
        { moderations: { create } } as never,
        { moderation: null } as OpenAI.Responses.Response,
        { input: "legitimate business question", output: "unsafe answer" },
      ),
    ).rejects.toThrow(ModerationBlockedError);
  });

  it("retries a transient standalone moderation failure", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary connection failure"))
      .mockResolvedValueOnce({
        results: [{ flagged: false, categories: {} }],
      });
    await expect(
      moderateUserMessage(
        { moderations: { create } } as never,
        "How can I improve cash flow?",
      ),
    ).resolves.toEqual({ flagged: false, blocked: false });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("fails closed after standalone moderation retries are exhausted", async () => {
    const create = vi.fn().mockRejectedValue(new Error("service unavailable"));
    await expect(
      moderateUserMessage(
        { moderations: { create } } as never,
        "How can I improve cash flow?",
      ),
    ).rejects.toMatchObject({
      name: "ModerationUnavailableError",
      diagnostic: {
        component: "moderation",
        stage: "user_input",
        reason: "request_failed",
      },
    } satisfies Partial<ModerationUnavailableError>);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("returns a sanitized result with no actions when generated output is blocked", async () => {
    const create = vi
      .fn()
      .mockResolvedValue(responseWith({ output: { harassment: true } }));
    const result = await requestConsultantResponse({
      openai: { responses: { create } } as never,
      model: "test-model",
      context: "Current workspace only",
      messages: [{ role: "user", content: "A legitimate question" }],
    });
    expect(result.moderationBlocked).toBe("output");
    expect(result.actionCalls).toEqual([]);
  });
});
