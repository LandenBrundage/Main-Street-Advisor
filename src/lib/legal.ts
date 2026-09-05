import { safeNextPath } from "@/lib/auth-redirect";

// Bump a version when its document changes and requires fresh acknowledgment.
export const TESTER_TERMS_VERSION = "2026-09-04";
export const PRIVACY_POLICY_VERSION = "2026-09-04";

export function legalNextPath(value?: string | null) {
  const path = safeNextPath(value);
  return path === "/app" ||
    path.startsWith("/app/") ||
    path.startsWith("/app?") ||
    path === "/onboarding"
    ? path
    : "/app";
}
