// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LegalAcceptanceForm } from "@/components/legal-acceptance-form";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("first-login acknowledgment form", () => {
  it("requires an explicit checkbox and navigates only after saving", async () => {
    const navigate = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accepted: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<LegalAcceptanceForm nextPath="/app/tasks" navigateTo={navigate} />);
    const button = screen.getByRole("button", { name: "Agree and continue" });
    expect(button).toHaveProperty("disabled", true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Tester Terms" }).getAttribute("target"),
    ).toBe("_blank");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/app/tasks"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays on the acknowledgment screen when saving fails and allows retry", async () => {
    const navigate = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "Please try again." }), {
            status: 503,
          }),
        ),
    );
    render(<LegalAcceptanceForm navigateTo={navigate} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Agree and continue" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Please try again.",
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Agree and continue" }),
    ).toHaveProperty("disabled", false);
  });

  it("allows declining by signing out without recording acceptance", async () => {
    const navigate = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    signOut.mockResolvedValue({ error: null });
    render(<LegalAcceptanceForm navigateTo={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
