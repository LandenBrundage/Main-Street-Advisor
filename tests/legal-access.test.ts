import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, hasAcceptedLegalDocuments } = vi.hoisted(() => ({
  getUser: vi.fn(),
  hasAcceptedLegalDocuments: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/legal-server", () => ({ hasAcceptedLegalDocuments }));
vi.mock("@/lib/config", () => ({ ENABLE_DEMO_MODE: false }));
import { requireUser } from "@/lib/supabase/server";
import { proxy } from "@/proxy";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  getUser.mockResolvedValue({
    data: { user: { id: "test-user" } },
    error: null,
  });
  hasAcceptedLegalDocuments.mockResolvedValue(false);
});
afterEach(() => vi.unstubAllEnvs());

describe("legal access gate", () => {
  it("blocks API authentication until acknowledgment is recorded", async () => {
    await expect(requireUser()).rejects.toMatchObject({
      code: "LEGAL_ACCEPTANCE_REQUIRED",
      status: 403,
    });
    hasAcceptedLegalDocuments.mockResolvedValue(true);
    await expect(requireUser()).resolves.toMatchObject({
      user: { id: "test-user" },
    });
  });

  it("allows the acknowledgment endpoint to authenticate without already accepting", async () => {
    await expect(
      requireUser({ requireAcceptance: false }),
    ).resolves.toMatchObject({ user: { id: "test-user" } });
    expect(hasAcceptedLegalDocuments).not.toHaveBeenCalled();
  });

  it.each(["/app", "/app/tasks?view=active", "/onboarding"])(
    "redirects first-time authenticated access from %s",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://example.com${path}`),
      );
      const destination = new URL(response.headers.get("location")!);
      expect(destination.pathname).toBe("/accept-terms");
      expect(destination.searchParams.get("next")).toBe(path);
    },
  );

  it("lets returning users through without another acknowledgment", async () => {
    hasAcceptedLegalDocuments.mockResolvedValue(true);
    const response = await proxy(new NextRequest("https://example.com/app"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows the review page and keeps the write endpoint protected against cross-site submissions", async () => {
    const page = await proxy(
      new NextRequest("https://example.com/accept-terms"),
    );
    expect(page.headers.get("location")).toBeNull();
    expect(hasAcceptedLegalDocuments).not.toHaveBeenCalled();
    const response = await proxy(
      new NextRequest("https://example.com/api/legal-acceptance", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "example.com" },
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("CROSS_SITE_BLOCKED");
  });

  it("requires sign-in before displaying the acceptance page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await proxy(
      new NextRequest("https://example.com/accept-terms"),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/sign-in",
    );
  });
});
