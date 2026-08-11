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
    expect(screen.getByLabelText("Business name *")).toBeTruthy();
    expect(screen.queryByLabelText("Your name")).toBeNull();
  });
});
