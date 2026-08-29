// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithOAuth = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const navigateTo = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth,
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
    },
  }),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  refresh.mockReset();
  signInWithOAuth.mockReset();
  signInWithPassword.mockReset();
  signUp.mockReset();
  resetPasswordForEmail.mockReset();
  navigateTo.mockReset();
});

describe("authentication form", () => {
  it("starts Google OAuth with the exact callback and preserved destination", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    render(
      <AuthForm
        mode="sign-in"
        nextPath="/app/tasks?view=active"
        navigateTo={navigateTo}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fapp%2Ftasks%3Fview%3Dactive",
        skipBrowserRedirect: true,
      },
    });
    expect(navigateTo).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(
      screen.getByRole("button", { name: "Connecting to Google…" }),
    ).toHaveProperty("disabled", true);
  });

  it("shows an understandable error when Google OAuth cannot start", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: new Error("Google provider is not enabled"),
    });
    render(<AuthForm mode="sign-in" navigateTo={navigateTo} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Google provider is not enabled",
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toHaveProperty("disabled", false);
  });

  it("returns password sign-in to the requested in-app page", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="sign-in" nextPath="/app/profile" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/profile"));
    expect(refresh).toHaveBeenCalled();
  });
});
