import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  enforceResponseModeration,
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
  it("blocks severe input but allows a supportive self-harm-intent discussion", () => {
    expect(() =>
      enforceResponseModeration(
        responseWith({ input: { "illicit/violent": true } }),
      ),
    ).toThrow(ModerationBlockedError);
    expect(() =>
      enforceResponseModeration(
        responseWith({ input: { "self-harm/intent": true } }),
      ),
    ).not.toThrow();
  });

  it("withholds unsafe output and fails closed when scores are unavailable", () => {
    expect(() =>
      enforceResponseModeration(responseWith({ output: { harassment: true } })),
    ).toThrow(ModerationBlockedError);
    expect(() =>
      enforceResponseModeration({ moderation: null } as OpenAI.Responses.Response),
    ).toThrow(ModerationUnavailableError);
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
