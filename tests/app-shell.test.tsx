// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("account navigation", () => {
  it("keeps Settings out of primary navigation and links the account control", () => {
    render(
      <AppShell
        user={{ name: "Avery Owner", email: "avery@example.com" }}
        initialConversations={[]}
      >
        <div>Page content</div>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    expect(
      within(primaryNavigation).queryByRole("link", { name: "Settings" }),
    ).toBeNull();
    expect(
      within(primaryNavigation)
        .getByRole("link", { name: "Goals & Tasks" })
        .getAttribute("href"),
    ).toBe("/app/tasks");
    expect(
      screen
        .getByRole("link", { name: "Account settings" })
        .getAttribute("href"),
    ).toBe("/app/settings");
  });

  it("clearly identifies when the fictional workspace is using billable real AI", () => {
    render(
      <AppShell
        demoMode
        demoUsesRealAi
        user={{ name: "Maya Chen", email: "maya@example.com" }}
        initialConversations={[]}
      >
        <div>Page content</div>
      </AppShell>,
    );
    expect(screen.getByText("Fictional customer workspace")).toBeTruthy();
    expect(
      screen.getByText(
        /Real AI is active\. Messages use your OpenAI API credits\./,
      ),
    ).toBeTruthy();
  });

  it("removes a consultation only after explicit confirmation", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AppShell
        user={{ name: "Avery Owner", email: "avery@example.com" }}
        initialConversations={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Private pricing review",
            updated_at: "2026-08-20",
          },
        ]}
      >
        <div>Page content</div>
      </AppShell>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete consultation: Private pricing review",
      }),
    );
    const confirmation = screen.getByRole("alertdialog", {
      name: "Delete consultation?",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete consultation: Private pricing review",
      }),
    );
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Delete consultation?" }),
      ).getByRole("button", { name: "Delete consultation" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Private pricing review")).toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/conversations/11111111-1111-4111-8111-111111111111",
      { method: "DELETE" },
    );
  });
});
