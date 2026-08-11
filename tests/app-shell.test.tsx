// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ replace: vi.fn() }),
}));

afterEach(cleanup);

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
});
