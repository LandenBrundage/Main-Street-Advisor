import { z } from "zod";

export const prioritySchema = z.enum(["na", "low", "medium", "high"]);
export const statusSchema = z.enum(["todo", "in_progress", "completed"]);
export const goalStatusSchema = z.enum(["incomplete", "completed"]);
const optionalDate = z.iso.date().optional().or(z.literal(""));

export const taskSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(160),
  description: z.string().trim().max(4000).optional().default(""),
  dueDate: optionalDate,
  priority: prioritySchema.default("na"),
  status: statusSchema.default("todo"),
  goalId: z.uuid().nullable().optional(),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(160),
  description: z.string().trim().max(4000).optional().default(""),
});

export const goalCompletionSchema = z.object({
  id: z.uuid(),
  completed: z.boolean(),
  completeRemainingTasks: z.boolean().default(false),
});

export const taskPlanSchema = z.object({
  goal: z.object({
    title: z.string().trim().min(1).max(160),
    description: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .optional()
      .transform((value) => value || undefined),
    targetDate: z.iso
      .date()
      .nullable()
      .optional()
      .transform((value) => value || undefined),
  }),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        description: z
          .string()
          .trim()
          .max(4000)
          .nullable()
          .optional()
          .transform((value) => value || undefined),
        dueDate: z.iso
          .date()
          .nullable()
          .optional()
          .transform((value) => value || undefined),
        priority: prioritySchema,
        order: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(30),
});

const shortText = z.string().trim().max(240).default("");
const longText = z.string().trim().max(6000).default("");
const stringList = z
  .array(z.string().trim().min(1).max(160))
  .max(30)
  .default([]);
const optionalNumber = z.union([
  z.number().int().min(0).max(1_000_000),
  z.literal(""),
]);

export const triedStrategySchema = z.object({
  strategy: z.string().trim().max(1000).default(""),
  result: z.string().trim().max(2000).default(""),
});

export const profileSchema = z.object({
  businessName: z.string().trim().max(160).default(""),
  basics: z
    .object({
      industry: shortText,
      industryOther: shortText,
      description: longText,
      location: z.string().trim().max(500).default(""),
      yearsInBusiness: optionalNumber.default(""),
      stage: z
        .enum([
          "",
          "idea",
          "recently_launched",
          "growing",
          "established",
          "declining",
        ])
        .default(""),
      businessStructure: z
        .enum(["", "online", "physical", "service_area", "hybrid"])
        .default(""),
      legalStructure: z
        .enum([
          "",
          "sole_proprietorship",
          "partnership",
          "llc",
          "corporation",
          "nonprofit",
          "other",
        ])
        .default(""),
      employees: optionalNumber.default(""),
      website: z.string().trim().url().or(z.literal("")).default(""),
    })
    .prefault({}),
  offerings: z
    .object({
      main: stringList,
      typicalPriceRange: shortText,
      bestSeller: shortText,
      revenueModels: stringList,
      salesChannels: stringList,
    })
    .prefault({}),
  customers: z
    .object({
      idealCustomer: longText,
      locations: z.string().trim().max(1000).default(""),
      discoveryChannels: stringList,
      whyChoose: longText,
      competitors: stringList,
      differentiation: longText,
    })
    .prefault({}),
  performance: z
    .object({
      monthlyRevenueRange: shortText,
      monthlyExpensesRange: shortText,
      averageSalesPerMonth: shortText,
      averageTransactionValue: shortText,
      mostProfitableOffering: shortText,
      recentTrend: z
        .enum(["", "growing", "stable", "declining", "unsure", "prefer_not"])
        .default(""),
      metricsTracked: stringList,
    })
    .prefault({}),
  operations: z
    .object({
      tools: stringList,
      responsibilities: longText,
      growthLimitations: stringList,
      seasonalPeriods: z.string().trim().max(2000).default(""),
      timeConsumingWork: z.string().trim().max(2000).default(""),
    })
    .prefault({}),
  goals: z
    .object({
      primaryGoal: z.string().trim().max(500).default(""),
      targetDate: z.iso.date().or(z.literal("")).default(""),
      successDefinition: longText,
      biggestObstacle: longText,
      triedStrategies: z.array(triedStrategySchema).max(20).default([]),
      availableResources: longText,
      excludedSolutions: stringList,
    })
    .prefault({}),
  advice: z
    .object({
      helpAreas: stringList,
      detailLevel: z
        .enum(["", "quick", "step_by_step", "detailed"])
        .default(""),
      ambition: z.enum(["", "low_risk", "balanced", "aggressive"]).default(""),
      hoursPerWeek: optionalNumber.default(""),
      primaryPriority: z
        .enum(["", "growth", "profitability", "stability", "saving_time"])
        .default(""),
    })
    .prefault({}),
  legacyAdditionalInformation: longText,
});

export const conversationSummarySchema = z.object({
  confirmedFacts: z.array(z.string().trim().min(1).max(500)).max(30),
  decisions: z.array(z.string().trim().min(1).max(500)).max(30),
  goalsAndConstraints: z.array(z.string().trim().min(1).max(500)).max(30),
  recommendedStrategies: z.array(z.string().trim().min(1).max(500)).max(30),
  confirmedActionsTried: z.array(z.string().trim().min(1).max(500)).max(30),
  confirmedResults: z.array(z.string().trim().min(1).max(500)).max(30),
  unresolvedQuestions: z.array(z.string().trim().min(1).max(500)).max(30),
});

export const taskCompletionProposalSchema = z.object({
  taskId: z.uuid(),
  confirmationText: z.string().trim().min(1).max(300),
});

export const accountNameSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(100),
});

export const aiPrivacySettingsSchema = z.object({
  workspaceContextEnabled: z.boolean(),
  crossConversationEnabled: z.boolean(),
  documentSearchEnabled: z.boolean(),
});

export const accountDeletionSchema = z.object({
  confirmation: z.string().trim().min(1).max(240),
});

export type TaskInput = z.infer<typeof taskSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type TaskPlan = z.infer<typeof taskPlanSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type TaskCompletionProposal = z.infer<
  typeof taskCompletionProposalSchema
>;
