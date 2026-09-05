import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TESTER_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  legalNextPath,
} from "@/lib/legal";

const { requireUser, upsert, from, maybeSingle, eq } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ requireUser }));
import { POST } from "@/app/api/legal-acceptance/route";
import { hasAcceptedLegalDocuments } from "@/lib/legal-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const client = { from } as unknown as SupabaseClient;
const payload = {
  accepted: true,
  termsVersion: TESTER_TERMS_VERSION,
  privacyVersion: PRIVACY_POLICY_VERSION,
};
function request(body: unknown) {
  return new Request("https://example.com/api/legal-acceptance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  eq.mockReturnValue({ eq, maybeSingle });
  from.mockReturnValue({ upsert, select: () => ({ eq }) });
  requireUser.mockResolvedValue({
    supabase: client,
    user: { id: "current-user" },
  });
  upsert.mockResolvedValue({ error: null });
});

describe("legal acknowledgment", () => {
  it("requires authentication before saving", async () => {
    requireUser.mockRejectedValue(new Error("AUTH_REQUIRED"));
    expect((await POST(request(payload))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    { ...payload, accepted: false },
    { ...payload, termsVersion: "outdated" },
    { ...payload, privacyVersion: "outdated" },
  ])("rejects missing acceptance or stale versions: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves for the signed-in user and preserves the original timestamp on retries", async () => {
    expect(
      (
        await POST(
          request({
            ...payload,
            user_id: "someone-else",
            accepted_at: "forged",
          }),
        )
      ).status,
    ).toBe(200);
    expect(requireUser).toHaveBeenCalledWith({ requireAcceptance: false });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "current-user",
        terms_version: TESTER_TERMS_VERSION,
        privacy_version: PRIVACY_POLICY_VERSION,
      },
      {
        onConflict: "user_id,terms_version,privacy_version",
        ignoreDuplicates: true,
      },
    );
  });

  it("does not report success when persistence fails", async () => {
    upsert.mockResolvedValue({ error: { message: "database unavailable" } });
    const response = await POST(request(payload));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("LEGAL_SAVE_FAILED");
  });

  it("requires acceptance for the current user and both current versions", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await hasAcceptedLegalDocuments(client, "new-user")).toBe(false);
    expect(eq).toHaveBeenCalledWith("user_id", "new-user");
    expect(eq).toHaveBeenCalledWith("terms_version", TESTER_TERMS_VERSION);
    expect(eq).toHaveBeenCalledWith("privacy_version", PRIVACY_POLICY_VERSION);
    maybeSingle.mockResolvedValueOnce({
      data: { accepted_at: "2026-09-04" },
      error: null,
    });
    expect(await hasAcceptedLegalDocuments(client, "returning-user")).toBe(
      true,
    );
  });

  it("fails closed when the acceptance lookup fails", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "unavailable" },
    });
    await expect(
      hasAcceptedLegalDocuments(client, "user"),
    ).rejects.toMatchObject({ code: "LEGAL_CHECK_FAILED" });
  });

  it("preserves workspace destinations and prevents external or looping redirects", () => {
    expect(legalNextPath("/app/tasks?view=active")).toBe(
      "/app/tasks?view=active",
    );
    for (const path of [
      "https://evil.example",
      "//evil.example",
      "/accept-terms",
      "/sign-in",
      "/api/account",
    ])
      expect(legalNextPath(path)).toBe("/app");
  });
});
