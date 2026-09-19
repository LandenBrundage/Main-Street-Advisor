import OpenAI from "openai";
import { OPENAI_MODERATION_MODEL } from "@/lib/config";

type ModerationSignal = {
  type?: string;
  flagged?: boolean;
  categories?: object;
};

type ModerationStage = "user_input" | "response_fallback";
type ModerationFailureReason =
  | "request_failed"
  | "missing_result"
  | "invalid_result";

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
  readonly diagnostic: Record<string, string | number>;

  constructor(
    stage: ModerationStage = "response_fallback",
    reason: ModerationFailureReason = "invalid_result",
    cause?: unknown,
  ) {
    super("MODERATION_UNAVAILABLE", { cause });
    this.name = "ModerationUnavailableError";
    this.diagnostic = { component: "moderation", stage, reason };
    if (cause && typeof cause === "object") {
      if ("status" in cause && typeof cause.status === "number")
        this.diagnostic.providerStatus = cause.status;
      if ("code" in cause && typeof cause.code === "string")
        this.diagnostic.providerCode = cause.code;
    }
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

function isModerationResult(
  signal: ModerationSignal | undefined,
): signal is ModerationSignal & { flagged: boolean; categories: object } {
  return (
    signal?.type !== "error" &&
    typeof signal?.flagged === "boolean" &&
    !!signal.categories &&
    typeof signal.categories === "object"
  );
}

function isRetryableModerationError(error: unknown) {
  if (!(error instanceof OpenAI.APIError)) return true;
  return (
    error.status === undefined ||
    error.status === 408 ||
    error.status === 409 ||
    error.status === 429 ||
    error.status >= 500
  );
}

async function requestModeration(
  openai: OpenAI,
  input: string | string[],
  expectedResults: number,
  stage: ModerationStage,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await openai.moderations.create({
        model: OPENAI_MODERATION_MODEL,
        input,
      }, { maxRetries: 0 });
      if (
        result.results.length >= expectedResults &&
        result.results.slice(0, expectedResults).every(isModerationResult)
      )
        return result.results.slice(0, expectedResults);
      lastError = new Error("MODERATION_RESULT_MISSING");
    } catch (error) {
      lastError = error;
      if (!isRetryableModerationError(error)) break;
    }
  }
  throw new ModerationUnavailableError(
    stage,
    lastError instanceof Error && lastError.message === "MODERATION_RESULT_MISSING"
      ? "missing_result"
      : "request_failed",
    lastError,
  );
}

export async function moderateUserMessage(openai: OpenAI, message: string) {
  const [signal] = await requestModeration(openai, message, 1, "user_input");
  return {
    flagged: signal.flagged,
    blocked: hasBlockedCategory(signal, blockedInputCategories),
  };
}

export async function enforceResponseModeration(
  openai: OpenAI,
  response: OpenAI.Responses.Response,
  fallback: { input: string; output: string },
) {
  const moderation = response.moderation;
  let inputSignal: ModerationSignal | undefined = isModerationResult(
    moderation?.input,
  )
    ? moderation.input
    : undefined;
  let outputSignal: ModerationSignal | undefined = isModerationResult(
    moderation?.output,
  )
    ? moderation.output
    : undefined;

  if (inputSignal && hasBlockedCategory(inputSignal, blockedInputCategories))
    throw new ModerationBlockedError("input");
  if (outputSignal && hasBlockedCategory(outputSignal, blockedOutputCategories))
    throw new ModerationBlockedError("output");

  if (!inputSignal || !outputSignal) {
    const fallbackSides = [
      ...(!inputSignal ? ([["input", fallback.input]] as const) : []),
      ...(!outputSignal ? ([["output", fallback.output]] as const) : []),
    ] as Array<readonly ["input" | "output", string]>;
    const fallbackSignals = await requestModeration(
      openai,
      fallbackSides.map(([, text]) => text),
      fallbackSides.length,
      "response_fallback",
    );
    fallbackSides.forEach(([side], index) => {
      if (side === "input") inputSignal = fallbackSignals[index];
      else outputSignal = fallbackSignals[index];
    });
  }

  if (!isModerationResult(inputSignal) || !isModerationResult(outputSignal))
    throw new ModerationUnavailableError(
      "response_fallback",
      "invalid_result",
    );
  if (hasBlockedCategory(inputSignal, blockedInputCategories))
    throw new ModerationBlockedError("input");
  if (hasBlockedCategory(outputSignal, blockedOutputCategories))
    throw new ModerationBlockedError("output");
  return { inputFlagged: inputSignal.flagged };
}

export const responseModerationConfig = {
  model: OPENAI_MODERATION_MODEL,
  policy: {
    input: { mode: "score" as const },
    output: { mode: "score" as const },
  },
};
