// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/confirm-dialog";

afterEach(cleanup);

describe("in-app delete confirmation", () => {
  it("shows a centered alert dialog and requires its explicit action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete task?"
        description="This task will be permanently deleted."
        confirmLabel="Delete task"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Delete task?" });
    expect(dialog.textContent).toContain("permanently deleted");
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("supports cancelling with Escape", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete consultation?"
        description="This cannot be undone."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
