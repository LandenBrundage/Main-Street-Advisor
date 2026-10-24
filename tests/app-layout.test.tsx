import { beforeEach, describe, expect, it, vi } from "vitest";
import Layout from "@/app/(app)/app/layout";

const { requireWorkspace } = vi.hoisted(() => ({ requireWorkspace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ requireWorkspace }));
vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  ENABLE_DEMO_MODE: false,
}));

beforeEach(() => requireWorkspace.mockReset());

function workspace(business: Record<string, unknown>, welcomed: boolean) {
  const scopedReads: Array<[string, string, string]> = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        scopedReads.push([table, column, value]);
        return query;
      },
      order: () => query,
      limit: async () => ({ data: [] }),
      maybeSingle: async () => ({
        data: {
          full_name: "Avery Owner",
          avatar_path: null,
          onboarding_completed_at: welcomed ? "2026-09-01T00:00:00Z" : null,
        },
      }),
      single: async () => ({ data: business, error: null }),
    };
    return query;
  });
  requireWorkspace.mockResolvedValue({
    supabase: { from },
    user: { id: "user-1", email: "avery@example.com" },
    businessId: "business-1",
  });
  return scopedReads;
}

describe("authenticated workspace onboarding", () => {
  it("uses the signed-in business's saved details to guide a new account", async () => {
    const scopedReads = workspace({ name: "Northstar Coffee" }, false);
    const page = await Layout({ children: <div>Workspace</div> });
    expect(page.props.demoMode).toBe(false);
    expect(page.props.showFirstTimeOnboarding).toBe(true);
    expect(
      page.props.initialMissingFields.map((field: { id: string }) => field.id),
    ).toEqual([
      "business-industry",
      "business-description",
      "main-products-services",
      "ideal-customer",
    ]);
    expect(page.props.tourStorageKey).toBe(
      "msa:workspace-tour:v1:user-1:business-1",
    );
    expect(page.props.user.name).toBe("Avery Owner");
    expect(scopedReads).toContainEqual(["businesses", "id", "business-1"]);
    expect(scopedReads).toContainEqual(["profiles", "id", "user-1"]);
  });

  it("leaves a returning account with complete saved details unlocked", async () => {
    workspace(
      {
        name: "Northstar Coffee",
        industry: "Food and beverage",
        description: "A neighborhood coffee shop.",
        products_services: "Coffee and pastries",
        target_customers: "Nearby workers",
      },
      true,
    );
    const page = await Layout({ children: <div>Workspace</div> });
    expect(page.props.initialMissingFields).toEqual([]);
    expect(page.props.showFirstTimeOnboarding).toBe(false);
    expect(page.props.demoMode).toBe(false);
  });
});
