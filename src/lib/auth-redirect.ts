const FALLBACK_PATH = "/app";
const REDIRECT_BASE = "https://main-street-advisor.invalid";

export function safeNextPath(
  value: string | null | undefined,
  fallback = FALLBACK_PATH,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value))
    return fallback;
  try {
    const parsed = new URL(value, REDIRECT_BASE);
    if (parsed.origin !== REDIRECT_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function oauthErrorMessage(code: string | null | undefined) {
  switch (code) {
    case "oauth_cancelled":
      return "Google sign-in was cancelled. No account changes were made.";
    case "oauth_missing_code":
      return "Google did not return the information needed to sign you in. Please try again.";
    case "oauth_exchange_failed":
      return "Google sign-in could not be completed. Please try again.";
    case "oauth_provider_error":
    case "oauth":
      return "Google sign-in could not be completed. Check the provider setup or try again.";
    default:
      return "";
  }
}
