// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FirstTimeOnboarding } from "@/components/first-time-onboarding";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { WorkspaceOnboardingProvider } from "@/components/workspace-onboarding";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("first-time onboarding", () => {
  it("keeps keyboard focus inside an open welcome when a profile guide appears", () => {
    const welcome = render(
      <WorkspaceOnboardingProvider
        initialMissingFields={[]}
        storageKey="welcome-focus-test"
        newUser
      >
        <FirstTimeOnboarding show />
        <OnboardingDialog
          title="Profile guide"
          onNext={vi.fn()}
          onClose={vi.fn()}
        >
          Add your required details.
        </OnboardingDialog>
      </WorkspaceOnboardingProvider>,
    );
    const close = screen.getByRole("button", { name: /^Close$/ });
    expect(document.activeElement).toBe(close);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Profile guide" })).toBeNull();
    expect(document.activeElement).toBe(close);
    welcome.unmount();
  });
  it("shows a short two-step welcome and opens the Business Profile", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ completed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FirstTimeOnboarding show />);

    expect(
      screen.getByRole("dialog", { name: "Meet your AI business advisor" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("dialog", { name: "Add a little business context" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", {
      method: "PATCH",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/profile"));
    expect(refresh).toHaveBeenCalled();
  });

  it("persists Close instead of showing on every login", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ completed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FirstTimeOnboarding show />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", {
      method: "PATCH",
    });
  });
});
