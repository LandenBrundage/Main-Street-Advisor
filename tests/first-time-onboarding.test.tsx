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
    fireEvent.click(
      screen.getByRole("button", { name: "Set Up Business Profile" }),
    );

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
