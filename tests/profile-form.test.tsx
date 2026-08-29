// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSectionEditor } from "@/components/profile/profile-sections";
import { emptyBusinessProfile } from "@/lib/profile";

afterEach(cleanup);

describe("business profile ownership boundaries", () => {
  it("shows business name but no personal display-name field", () => {
    render(
      <ProfileSectionEditor
        section="basics"
        profile={emptyBusinessProfile()}
        setRoot={vi.fn()}
        setField={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Business name/)).toHaveProperty(
      "required",
      true,
    );
    expect(screen.getByLabelText(/Industry/)).toHaveProperty("required", true);
    expect(screen.queryByLabelText("Your name")).toBeNull();
  });

  it("uses the required marker as the optional-field convention", () => {
    render(
      <ProfileSectionEditor
        section="customers"
        profile={emptyBusinessProfile()}
        setRoot={vi.fn()}
        setField={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Ideal customer/)).toHaveProperty(
      "required",
      true,
    );
    expect(screen.getByLabelText("Main competitors")).toBeTruthy();
    expect(screen.queryByText(/\(optional\)/i)).toBeNull();
  });
});
