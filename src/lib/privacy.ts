export type AIPrivacySettings = {
  workspaceContextEnabled: boolean;
  crossConversationEnabled: boolean;
  documentSearchEnabled: boolean;
};

export const DEFAULT_AI_PRIVACY_SETTINGS: AIPrivacySettings = {
  workspaceContextEnabled: true,
  crossConversationEnabled: true,
  documentSearchEnabled: true,
};

const privateKeyPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i;
const commonSecretPattern =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/;
const socialSecurityPattern =
  /\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/;

function hasPaymentCardNumber(value: string) {
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) || [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      double = !double;
    }
    return sum % 10 === 0;
  });
}

export function detectHighRiskSecret(value: string) {
  if (privateKeyPattern.test(value)) return "private_key" as const;
  if (commonSecretPattern.test(value)) return "api_key" as const;
  if (socialSecurityPattern.test(value)) return "social_security_number" as const;
  if (hasPaymentCardNumber(value)) return "payment_card" as const;
  return null;
}

export async function createSafetyIdentifier(subject: string) {
  const configuredSecret = process.env.AI_SAFETY_IDENTIFIER_SECRET;
  if (!configuredSecret && process.env.NODE_ENV === "production")
    throw new Error("AI_SAFETY_IDENTIFIER_SECRET is required in production.");
  const secret = configuredSecret || "main-street-advisor-local-development";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(subject),
  );
  return Buffer.from(signature).toString("base64url");
}
