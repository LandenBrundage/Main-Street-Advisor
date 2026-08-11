const PROFILE_FIELDS: [string, string][] = [
  ["name", "Business name"],
  ["legal_structure", "Legal structure"],
  ["industry", "Industry"],
  ["website", "Website"],
  ["location", "Location"],
  ["year_founded", "Year founded"],
  ["employee_count", "Employees"],
  ["description", "Description"],
  ["products_services", "Products/services"],
  ["target_customers", "Target customers"],
  ["business_model", "Business model"],
  ["organization", "Organization"],
  ["current_goals", "Current goals"],
  ["current_challenges", "Current challenges"],
  ["competitive_advantages", "Competitive advantages"],
  ["annual_revenue", "Approximate annual revenue"],
  ["fixed_costs", "Major fixed costs"],
  ["variable_costs", "Major variable costs"],
  ["pricing_info", "Pricing"],
  ["budget_constraints", "Budget constraints"],
  ["financial_notes", "Financial notes"],
];

export function buildBusinessContext(business: Record<string, unknown>) {
  const populated = PROFILE_FIELDS.flatMap(([key, label]) => {
    const value = business[key];
    return value === null || value === undefined || String(value).trim() === ""
      ? []
      : [`${label}: ${String(value).trim()}`];
  });
  return [
    "Untrusted business profile data:",
    ...(populated.length
      ? populated
      : ["No profile details have been saved yet."]),
  ].join("\n");
}
