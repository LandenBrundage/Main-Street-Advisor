import { describe, expect, it } from "vitest";
function canAccess(
  memberships: { userId: string; businessId: string }[],
  userId: string,
  businessId: string,
) {
  return memberships.some(
    (m) => m.userId === userId && m.businessId === businessId,
  );
}
describe("workspace authorization", () => {
  it("permits only matching memberships", () => {
    const m = [{ userId: "u1", businessId: "b1" }];
    expect(canAccess(m, "u1", "b1")).toBe(true);
    expect(canAccess(m, "u2", "b1")).toBe(false);
    expect(canAccess(m, "u1", "b2")).toBe(false);
  });
});
