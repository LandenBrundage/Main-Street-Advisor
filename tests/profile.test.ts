import { describe, expect, it } from "vitest";
import {
  buildBusinessSnapshot,
  mapStoredBusinessProfile,
  profileCompletion,
} from "@/lib/profile";
import { profileSchema } from "@/lib/schemas";

describe("sectioned business profile migration", () => {
  it("preserves legacy values and normalizes a human-readable legal structure", () => {
    const profile = mapStoredBusinessProfile({
      business: {
        name: "Northstar Coffee",
        industry: "Food and beverage",
        legal_structure: "Limited Liability Company",
        description: "A neighborhood coffee shop.",
        products_services: "Coffee and pastries",
        target_customers: "Nearby remote workers",
        current_goals: "Increase weekday sales",
        current_challenges: "Quiet afternoons",
        annual_revenue: "$250,000–$500,000",
        fixed_costs: "Rent and payroll",
      },
    });

    expect(profile.basics.legalStructure).toBe("llc");
    expect("name" in profile).toBe(false);
    expect(profile.offerings.main).toEqual(["Coffee and pastries"]);
    expect(profile.legacyAdditionalInformation).toContain(
      "Approximate annual revenue: $250,000–$500,000",
    );
    expect(profile.legacyAdditionalInformation).toContain(
      "Major fixed costs: Rent and payroll",
    );
    expect(profileCompletion(profile)).toBe(100);
  });

  it("keeps empty profile drafts out of the compact always-on snapshot", () => {
    const profile = mapStoredBusinessProfile({
      business: {
        name: "Northstar Coffee",
        profile_details: {
          goals: {
            triedStrategies: [
              { strategy: "", result: "" },
              { strategy: "Ran a weekday bundle", result: "Sales rose 8%" },
            ],
          },
        },
      },
    });
    const snapshot = buildBusinessSnapshot(profile);
    expect(JSON.stringify(snapshot)).not.toContain('"strategy":""');
    expect(JSON.stringify(snapshot)).toContain("Ran a weekday bundle");
  });

  it("strips an obsolete personal name from profile payloads and AI context", () => {
    const profile = profileSchema.parse({
      name: "Avery Owner",
      businessName: "Northstar Coffee",
      basics: { description: "A neighborhood coffee shop." },
    });
    expect("name" in profile).toBe(false);
    expect(JSON.stringify(buildBusinessSnapshot(profile))).not.toContain(
      "Avery Owner",
    );
    expect(JSON.stringify(buildBusinessSnapshot(profile))).toContain(
      "Northstar Coffee",
    );
  });
});
