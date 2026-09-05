// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "@/app/page";

afterEach(cleanup);

describe("public landing page", () => {
  it("explains the product without presenting it as a pilot", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "A clearer path from business question to next step.",
      }),
    ).toBeTruthy();
    expect(document.body.textContent).toContain(
      "Practical support for everyday business decisions.",
    );
    expect(document.body.textContent).not.toMatch(/\bpilot\b/i);
  });

  it("has a home-linked logo and distinct account actions", () => {
    render(<Page />);

    expect(
      screen
        .getAllByRole("link", { name: "Main Street Advisor home" })[0]
        .getAttribute("href"),
    ).toBe("/");

    const signIn = screen.getAllByRole("link", { name: "Sign in" })[0];
    const createAccount = screen.getAllByRole("link", {
      name: "Create account",
    })[0];
    expect(signIn.getAttribute("href")).toBe("/sign-in");
    expect(signIn.className).toContain("bg-white");
    expect(signIn.className).toContain("border");
    expect(createAccount.getAttribute("href")).toBe("/sign-up");
    expect(createAccount.className).toContain("bg-blue-600");
  });
});
