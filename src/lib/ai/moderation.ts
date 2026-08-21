import type OpenAI from "openai";
import { OPENAI_MODERATION_MODEL } from "@/lib/config";

type ModerationSignal = {
  type?: string;
  flagged?: boolean;
  categories?: object;
};

const blockedInputCategories = new Set([
  "sexual/minors",
  "hate/threatening",
  "harassment/threatening",
  "illicit/violent",
  "self-harm/instructions",
  "violence/graphic",
]);

const blockedOutputCategories = new Set([
  "sexual",
  "sexual/minors",
  "hate",
  "hate/threatening",
  "harassment",
  "harassment/threatening",
  "illicit",
  "illicit/violent",
  "self-harm/instructions",
  "violence/graphic",
]);

export class ModerationUnavailableError extends Error {
  constructor() {
    super("MODERATION_UNAVAILABLE");
  }
}

export class ModerationBlockedError extends Error {
  constructor(public side: "input" | "output") {
    super(side === "input" ? "MODERATION_INPUT_BLOCKED" : "MODERATION_OUTPUT_BLOCKED");
  }
}

function hasBlockedCategory(
  signal: ModerationSignal,
  categories: ReadonlySet<string>,
) {
  return Object.entries(signal.categories || {}).some(
    ([category, flagged]) => flagged === true && categories.has(category),
  );
}

export async function moderateUserMessage(openai: OpenAI, message: string) {
  const result = await openai.moderations.create({
    model: OPENAI_MODERATION_MODEL,
    input: message,
  });
  const signal = result.results[0];
  if (!signal) throw new ModerationUnavailableError();
  return {
    flagged: signal.flagged,
    blocked: hasBlockedCategory(signal, blockedInputCategories),
  };
}

export function enforceResponseModeration(response: OpenAI.Responses.Response) {
  const moderation = response.moderation;
  if (!moderation) throw new ModerationUnavailableError();
  if (moderation.input.type === "error" || moderation.output.type === "error")
    throw new ModerationUnavailableError();
  if (hasBlockedCategory(moderation.input, blockedInputCategories))
    throw new ModerationBlockedError("input");
  if (hasBlockedCategory(moderation.output, blockedOutputCategories))
    throw new ModerationBlockedError("output");
  return { inputFlagged: moderation.input.flagged };
}

export const responseModerationConfig = {
  model: OPENAI_MODERATION_MODEL,
  policy: {
    input: { mode: "score" as const },
    output: { mode: "score" as const },
  },
};
