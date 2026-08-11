import { profileSchema, type ProfileInput } from "@/lib/schemas";

export const PROFILE_SECTION_KEYS = [
  "basics",
  "offerings",
  "customers",
  "performance",
  "operations",
  "goals",
  "advice",
] as const;

export type ProfileSectionKey = (typeof PROFILE_SECTION_KEYS)[number];

export function emptyBusinessProfile(): ProfileInput {
  return profileSchema.parse({});
}

export function mapStoredBusinessProfile({
  business,
}: {
  business: Record<string, unknown>;
}): ProfileInput {
  const legacy = legacyProfileDetails(business);
  const stored = isRecord(business.profile_details)
    ? business.profile_details
    : {};
  const basics = mergeRecord(legacy.basics, stored.basics);
  basics.legalStructure = normalizeLegalStructure(basics.legalStructure);
  return profileSchema.parse({
    ...legacy,
    ...stored,
    businessName: stringValue(business.name),
    basics,
    offerings: mergeRecord(legacy.offerings, stored.offerings),
    customers: mergeRecord(legacy.customers, stored.customers),
    performance: mergeRecord(legacy.performance, stored.performance),
    operations: mergeRecord(legacy.operations, stored.operations),
    goals: mergeRecord(legacy.goals, stored.goals),
    advice: mergeRecord(legacy.advice, stored.advice),
    legacyAdditionalInformation:
      stringValue(stored.legacyAdditionalInformation) ||
      legacy.legacyAdditionalInformation,
  });
}

export function buildBusinessSnapshot(profile: ProfileInput) {
  const industry =
    profile.basics.industry === "Other"
      ? profile.basics.industryOther
      : profile.basics.industry;
  return compactObject({
    identity: compactObject({
      name: profile.businessName,
      industry,
      description: profile.basics.description,
      stage: profile.basics.stage,
      structure: profile.basics.businessStructure,
      location: profile.basics.location,
      yearsInBusiness: profile.basics.yearsInBusiness,
      employees: profile.basics.employees,
    }),
    offer: compactObject({
      productsAndServices: profile.offerings.main,
      typicalPriceRange: profile.offerings.typicalPriceRange,
      bestSeller: profile.offerings.bestSeller,
      revenueModels: profile.offerings.revenueModels,
      salesChannels: profile.offerings.salesChannels,
    }),
    market: compactObject({
      idealCustomer: profile.customers.idealCustomer,
      customerLocations: profile.customers.locations,
      discoveryChannels: profile.customers.discoveryChannels,
      competitivePosition:
        profile.customers.differentiation || profile.customers.whyChoose,
    }),
    performance: compactObject({
      monthlyRevenueRange: profile.performance.monthlyRevenueRange,
      monthlyExpensesRange: profile.performance.monthlyExpensesRange,
      averageSalesPerMonth: profile.performance.averageSalesPerMonth,
      averageTransactionValue: profile.performance.averageTransactionValue,
      recentTrend: profile.performance.recentTrend,
      metricsTracked: profile.performance.metricsTracked,
    }),
    constraints: compactObject({
      growthLimitations: profile.operations.growthLimitations,
      timeConsumingWork: profile.operations.timeConsumingWork,
      availableResources: profile.goals.availableResources,
      excludedSolutions: profile.goals.excludedSolutions,
    }),
    currentFocus: compactObject({
      primaryGoal: profile.goals.primaryGoal,
      targetDate: profile.goals.targetDate,
      successDefinition: profile.goals.successDefinition,
      biggestObstacle: profile.goals.biggestObstacle,
      confirmedStrategiesTried: profile.goals.triedStrategies.filter(
        ({ strategy }) => Boolean(strategy),
      ),
    }),
    advicePreferences: compactObject({
      helpAreas: profile.advice.helpAreas,
      detailLevel: profile.advice.detailLevel,
      ambition: profile.advice.ambition,
      hoursPerWeek: profile.advice.hoursPerWeek,
      primaryPriority: profile.advice.primaryPriority,
    }),
  });
}

export function serializeBusinessSnapshot(snapshot: Record<string, unknown>) {
  return `Untrusted compact business snapshot:\n${JSON.stringify(snapshot)}`;
}

export function profileCompletion(profile: ProfileInput) {
  const checks = [
    profile.businessName,
    profile.basics.industry || profile.basics.industryOther,
    profile.basics.description,
    profile.offerings.main.length,
    profile.customers.idealCustomer,
    profile.goals.primaryGoal,
    profile.goals.biggestObstacle,
  ];
  return Math.round(
    (checks.filter((value) =>
      typeof value === "number" ? value > 0 : Boolean(value),
    ).length /
      checks.length) *
      100,
  );
}

export function profileToLegacyColumns(profile: ProfileInput) {
  const yearFounded =
    typeof profile.basics.yearsInBusiness === "number"
      ? new Date().getFullYear() - profile.basics.yearsInBusiness
      : null;
  return {
    name: profile.businessName,
    legal_structure: profile.basics.legalStructure || null,
    industry:
      profile.basics.industry === "Other"
        ? profile.basics.industryOther || "Other"
        : profile.basics.industry || null,
    website: profile.basics.website || null,
    location: profile.basics.location || null,
    year_founded: yearFounded,
    employee_count:
      typeof profile.basics.employees === "number"
        ? profile.basics.employees
        : null,
    description: profile.basics.description || null,
    products_services: profile.offerings.main.join("; ") || null,
    target_customers: profile.customers.idealCustomer || null,
    business_model: profile.offerings.revenueModels.join(", ") || null,
    organization: profile.operations.responsibilities || null,
    current_goals: profile.goals.primaryGoal || null,
    current_challenges: profile.goals.biggestObstacle || null,
    competitive_advantages:
      profile.customers.differentiation || profile.customers.whyChoose || null,
    pricing_info: profile.offerings.typicalPriceRange || null,
  };
}

function legacyProfileDetails(business: Record<string, unknown>) {
  const founded = numberValue(business.year_founded);
  const yearsInBusiness = founded
    ? Math.max(0, new Date().getFullYear() - founded)
    : "";
  const products = stringValue(business.products_services);
  const additional = [
    ["Legacy legal structure", business.legal_structure],
    ["Legacy business model", business.business_model],
    ["Approximate annual revenue", business.annual_revenue],
    ["Major fixed costs", business.fixed_costs],
    ["Major variable costs", business.variable_costs],
    ["Budget constraints", business.budget_constraints],
    ["Additional financial notes", business.financial_notes],
  ]
    .flatMap(([label, value]) => {
      const text = stringValue(value);
      return text ? [`${label}: ${text}`] : [];
    })
    .join("\n");
  return {
    businessName: stringValue(business.name),
    basics: {
      industry: stringValue(business.industry),
      description: stringValue(business.description),
      location: stringValue(business.location),
      yearsInBusiness,
      legalStructure: stringValue(business.legal_structure),
      employees: numberValue(business.employee_count) ?? "",
      website: stringValue(business.website),
    },
    offerings: {
      main: products ? [products] : [],
      typicalPriceRange: stringValue(business.pricing_info),
      revenueModels: [],
      salesChannels: [],
    },
    customers: {
      idealCustomer: stringValue(business.target_customers),
      discoveryChannels: [],
      whyChoose: stringValue(business.competitive_advantages),
      competitors: [],
      differentiation: stringValue(business.competitive_advantages),
    },
    performance: { metricsTracked: [] },
    operations: {
      tools: [],
      responsibilities: stringValue(business.organization),
      growthLimitations: [],
    },
    goals: {
      primaryGoal: stringValue(business.current_goals),
      biggestObstacle: stringValue(business.current_challenges),
      triedStrategies: [],
      excludedSolutions: [],
    },
    advice: { helpAreas: [] },
    legacyAdditionalInformation: additional,
  };
}

function compactObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.length ? [[key, value]] : [];
      if (isRecord(value)) {
        const nested = compactObject(value);
        return Object.keys(nested).length ? [[key, nested]] : [];
      }
      return value === "" || value === null || value === undefined
        ? []
        : [[key, value]];
    }),
  );
}

function mergeRecord(left: unknown, right: unknown) {
  return { ...(isRecord(left) ? left : {}), ...(isRecord(right) ? right : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLegalStructure(value: unknown) {
  const normalized = stringValue(value).toLowerCase().replace(/[ -]+/g, "_");
  const aliases: Record<string, string> = {
    sole_proprietor: "sole_proprietorship",
    sole_prop: "sole_proprietorship",
    limited_liability_company: "llc",
    non_profit: "nonprofit",
  };
  const result = aliases[normalized] || normalized;
  return [
    "",
    "sole_proprietorship",
    "partnership",
    "llc",
    "corporation",
    "nonprofit",
    "other",
  ].includes(result)
    ? result
    : "other";
}
