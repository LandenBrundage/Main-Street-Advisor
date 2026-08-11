import type OpenAI from "openai";

export function fallbackTitle(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  const words = compact.split(" ").slice(0, 7).join(" ");
  return words.length < compact.length ? `${words}…` : words;
}

export async function createConversationTitle({
  openai,
  model,
  message,
  onError,
}: {
  openai: OpenAI | null;
  model: string;
  message: string;
  onError?: (error: unknown) => void;
}) {
  const fallback = fallbackTitle(message);
  if (!openai) return fallback;
  try {
    const response = await openai.responses.create({
      model,
      instructions:
        "Create a concise 3–7 word title for this small-business consultation. Return only the title, without quotation marks or punctuation at the end.",
      input: message,
      max_output_tokens: 30,
      store: false,
    });
    return (
      response.output_text
        .trim()
        .replace(/^[\"']|[\"'.]$/g, "")
        .slice(0, 80) || fallback
    );
  } catch (error) {
    onError?.(error);
    return fallback;
  }
}
