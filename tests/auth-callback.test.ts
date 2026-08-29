import { describe, expect, it, vi } from "vitest";
import { oauthErrorMessage, safeNextPath } from "@/lib/auth-redirect";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

describe("OAuth callback", () => {
  it("exchanges the code and returns to the requested in-app destination", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const response = await GET(
      new Request(
        "https://main-street-advisor-eight.vercel.app/auth/callback?code=test-code&next=%2Fapp%2Ftasks%3Fview%3Dactive",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe(
      "https://main-street-advisor-eight.vercel.app/app/tasks?view=active",
    );
  });

  it("rejects external return URLs", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const response = await GET(
      new Request(
        "https://main-street-advisor-eight.vercel.app/auth/callback?code=test-code&next=https%3A%2F%2Fevil.example%2Fsteal",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://main-street-advisor-eight.vercel.app/app",
    );
  });

  it("reports cancellation without attempting a session exchange", async () => {
    exchangeCodeForSession.mockClear();
    const response = await GET(
      new Request(
        "https://main-street-advisor-eight.vercel.app/auth/callback?error=access_denied&next=%2Fapp%2Fprofile",
      ),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("error")).toBe("oauth_cancelled");
    expect(location.searchParams.get("next")).toBe("/app/profile");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("safe authentication redirects", () => {
  it("allows local paths and blocks protocol-relative or backslash redirects", () => {
    expect(safeNextPath("/app/profile?section=basics")).toBe(
      "/app/profile?section=basics",
    );
    expect(safeNextPath("//evil.example/steal")).toBe("/app");
    expect(safeNextPath("/\\evil.example/steal")).toBe("/app");
    expect(safeNextPath("https://evil.example/steal")).toBe("/app");
  });

  it("uses stable, non-sensitive OAuth error copy", () => {
    expect(oauthErrorMessage("oauth_exchange_failed")).toContain(
      "could not be completed",
    );
    expect(oauthErrorMessage("unknown-provider-detail")).toBe("");
  });
});
