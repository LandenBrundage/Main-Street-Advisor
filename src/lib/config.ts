export const PRODUCT_NAME =
  process.env.NEXT_PUBLIC_PRODUCT_NAME || "Main Street Advisor";
export const PRODUCT_LOGO_PATH = "/main-street-advisor-logo.png";
export const BRAND_TRUST_BLUE = "#003CA2";
export const PRODUCT_DESCRIPTION =
  "Practical AI consulting and action planning for small businesses.";
export const LEGAL_ENTITY_NAME = "Main Street Advisor LLC";
export const LEGAL_EFFECTIVE_DATE = "September 4, 2026";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
export const OPENAI_MODERATION_MODEL =
  process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest";
export const ENABLE_AI_MOCKS =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_AI_MOCKS === "true";
export const ENABLE_DEMO_MODE =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEMO_MODE === "true";
export const ENABLE_DEMO_AI =
  ENABLE_DEMO_MODE && process.env.ENABLE_DEMO_AI === "true";
function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
export const AI_RECENT_MESSAGE_LIMIT = positiveInteger(
  process.env.AI_RECENT_MESSAGE_LIMIT,
  12,
);
export const AI_SUMMARY_TRIGGER_MESSAGES = positiveInteger(
  process.env.AI_SUMMARY_TRIGGER_MESSAGES,
  24,
);
export const AI_SUMMARY_BATCH_SIZE = positiveInteger(
  process.env.AI_SUMMARY_BATCH_SIZE,
  20,
);
export const AI_PREVIOUS_SUMMARY_LIMIT = positiveInteger(
  process.env.AI_PREVIOUS_SUMMARY_LIMIT,
  3,
);
export const AI_MAX_OUTPUT_TOKENS = positiveInteger(
  process.env.AI_MAX_OUTPUT_TOKENS,
  3000,
);
export const PRIVACY_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_SUPPORT_EMAIL || "mstreetadvisor@gmail.com";
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
