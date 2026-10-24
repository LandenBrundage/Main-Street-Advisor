// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingSpotlight } from "@/components/onboarding-spotlight";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function prepareTarget(button: HTMLButtonElement) {
  const rect = new DOMRect(200, 500, 130, 36);
  vi.spyOn(button, "getClientRects").mockReturnValue([
    rect,
  ] as unknown as DOMRectList);
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(rect);
  button.scrollIntoView = vi.fn();
}

describe("tutorial spotlight", () => {
  it("shows an informational target without allowing activation or focusing it", async () => {
    const onTarget = vi.fn();
    const onNext = vi.fn();
    const trigger = render(
      <button id="preview-control" onClick={onTarget}>
        Prompt builder
      </button>,
    );
    const button = screen.getByRole("button", {
      name: "Prompt builder",
    }) as HTMLButtonElement;
    prepareTarget(button);
    const view = render(
      <OnboardingSpotlight
        interactiveTarget={false}
        targetSelector="#preview-control"
        title="About this button"
        eyebrow="Tutorial"
        nextLabel="Next"
        onNext={onNext}
        onClose={vi.fn()}
      >
        Use this after the tour.
      </OnboardingSpotlight>,
    );
    await screen.findByRole("dialog", { name: "About this button" });
    expect(button.inert).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(button);
    expect(onTarget).not.toHaveBeenCalled();
    const close = screen.getByRole("button", { name: "Close" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(button.inert).toBe(false);
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    expect(button.hasAttribute("tabindex")).toBe(false);
    fireEvent.click(button);
    expect(onTarget).toHaveBeenCalledTimes(1);
    trigger.unmount();
  });
  it("keeps the actual control interactive and includes it in keyboard navigation", async () => {
    const onTarget = vi.fn();
    const onClose = vi.fn();
    const trigger = render(
      <button
        id="real-control"
        aria-describedby="existing-help"
        onClick={onTarget}
      >
        Real control
      </button>,
    );
    const button = screen.getByRole("button", {
      name: "Real control",
    }) as HTMLButtonElement;
    prepareTarget(button);
    button.focus();
    const previousOverflow = document.body.style.overflow;
    const view = render(
      <OnboardingSpotlight
        targetSelector="#real-control"
        title="Try this control"
        eyebrow="Tutorial"
        nextLabel="Open control"
        onNext={vi.fn()}
        onClose={onClose}
      >
        Select the highlighted button.
      </OnboardingSpotlight>,
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Try this control",
    });
    expect(dialog.getAttribute("aria-owns")).toBe("real-control");
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-describedby")).toContain("existing-help");
    fireEvent.click(button);
    expect(onTarget).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open control" }),
    );
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(button.getAttribute("aria-describedby")).toBe("existing-help");
    expect(document.body.style.overflow).toBe(previousOverflow);
    trigger.unmount();
  });

  it("waits for a control mounted by the mobile navigation", async () => {
    render(
      <OnboardingSpotlight
        targetSelector="#late-control"
        title="Open the tab"
        eyebrow="Tutorial"
        nextLabel="Open tab"
        onNext={vi.fn()}
        onClose={vi.fn()}
      >
        Select this tab.
      </OnboardingSpotlight>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const button = document.createElement("button");
    button.id = "late-control";
    button.textContent = "Goals & Tasks";
    prepareTarget(button);
    await act(async () => {
      document.body.append(button);
    });
    expect(
      await screen.findByRole("dialog", { name: "Open the tab" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(button);
    cleanup();
    button.remove();
  });
});
