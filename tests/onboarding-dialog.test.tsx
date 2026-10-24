// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingDialog } from "@/components/onboarding-dialog";

afterEach(cleanup);

describe("tutorial dialog", () => {
  it("contains keyboard focus, closes with Escape, and restores the page on dismissal", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const previousOverflow = document.body.style.overflow;
    const onClose = vi.fn();
    const dialog = render(
      <OnboardingDialog
        title="A little guidance"
        onClose={onClose}
        onNext={vi.fn()}
      >
        A short introduction.
      </OnboardingDialog>,
    );
    expect(
      screen
        .getByRole("dialog", { name: "A little guidance" })
        .getAttribute("aria-modal"),
    ).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    const close = screen.getByRole("button", { name: /^Close$/ });
    const next = screen.getByRole("button", { name: "Next" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    dialog.unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
