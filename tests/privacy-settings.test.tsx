// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "@/components/settings/account-settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("privacy settings", () => {
  it("shows controllable AI sources, reporting, and guarded account deletion", async () => {
    const account = {
      name: "Avery Owner",
      email: "avery@example.com",
      avatarUrl: null,
      providers: ["email"],
      isOAuthOnly: false,
      accountDeletion: {
        configured: true,
        eligible: true,
        businessName: "Northstar Coffee",
      },
    };
    const privacy = {
      workspaceContextEnabled: true,
      crossConversationEnabled: true,
      documentSearchEnabled: true,
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/settings") return jsonResponse(account);
      if (url === "/api/settings/privacy" && !options?.method)
        return jsonResponse({ settings: privacy });
      if (url === "/api/settings/privacy" && options?.method === "PATCH")
        return jsonResponse({
          saved: true,
          settings: JSON.parse(String(options?.body)),
        });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSettings supportEmail="privacy@example.com" />);
    await screen.findByRole("heading", { name: "AI privacy controls" });
    const previousConsultations = screen.getByRole("switch", {
      name: "Previous consultations",
    });
    expect(previousConsultations.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(previousConsultations);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/settings/privacy",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    expect(previousConsultations.getAttribute("aria-checked")).toBe("false");
    expect(
      screen
        .getByRole("link", { name: "Report a privacy or safety issue" })
        .getAttribute("href"),
    ).toContain("privacy@example.com");

    fireEvent.click(
      screen.getByRole("button", { name: "Delete account and workspace" }),
    );
    const permanentDelete = screen.getByRole("button", {
      name: "Permanently delete everything",
    });
    expect((permanentDelete as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(
      screen.getByLabelText("Enter Northstar Coffee to confirm"),
      { target: { value: "Northstar Coffee" } },
    );
    expect((permanentDelete as HTMLButtonElement).disabled).toBe(false);
  });
});
