import { fallbackTitle } from "@/lib/ai/title";
import type { Goal, Priority, Task, TaskStatus } from "@/lib/domain";
import {
  buildBusinessSnapshot,
  mapStoredBusinessProfile,
  profileToLegacyColumns,
} from "@/lib/profile";
import {
  profileSchema,
  type ConversationSummary,
  type ProfileInput,
  type TaskPlan,
} from "@/lib/schemas";
import {
  DEFAULT_AI_PRIVACY_SETTINGS,
  type AIPrivacySettings,
} from "@/lib/privacy";

type DemoUser = {
  id: string;
  email: string;
};

type DemoBusiness = {
  id: string;
  name: string;
  legal_structure: string | null;
  industry: string | null;
  website: string | null;
  location: string | null;
  year_founded: number | null;
  employee_count: number | null;
  description: string | null;
  products_services: string | null;
  target_customers: string | null;
  business_model: string | null;
  organization: string | null;
  current_goals: string | null;
  current_challenges: string | null;
  competitive_advantages: string | null;
  annual_revenue: string | null;
  fixed_costs: string | null;
  variable_costs: string | null;
  pricing_info: string | null;
  budget_constraints: string | null;
  financial_notes: string | null;
  vector_store_id?: string | null;
  profile_details?: Record<string, unknown>;
  business_snapshot?: Record<string, unknown>;
  primary_goal_id?: string | null;
  ai_workspace_context_enabled?: boolean;
  ai_cross_conversation_enabled?: boolean;
  ai_document_search_enabled?: boolean;
};

type DemoProfile = {
  full_name: string;
};

type DemoConversation = {
  id: string;
  title: string;
  business_id: string;
  created_by: string;
  updated_at: string;
  summary: ConversationSummary | null;
  summarized_message_count: number;
  summary_updated_at: string | null;
};

type DemoMessage = {
  id: string;
  conversation_id: string;
  business_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type DemoDocument = {
  id: string;
  business_id: string;
  uploaded_by: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: "uploading" | "processing" | "ready" | "failed";
  created_at: string;
  error_message?: string | null;
  openai_file_id?: string | null;
  vector_store_id?: string | null;
  extracted_text?: string | null;
};

type DemoProposal = {
  id: string;
  business_id: string;
  conversation_id: string;
  created_by: string;
  idempotency_key: string;
  status: "proposed" | "approved" | "cancelled" | "failed";
  payload: TaskPlan;
  approved_goal_id?: string | null;
  approved_task_ids?: string[] | null;
};

type DemoCompletionRequest = {
  id: string;
  business_id: string;
  conversation_id: string;
  task_id: string;
  created_by: string;
  idempotency_key: string;
  status: "proposed" | "approved" | "cancelled" | "failed";
  confirmation_text: string;
  created_at: string;
  approved_at: string | null;
};

type DemoState = {
  user: DemoUser;
  profile: DemoProfile;
  business: DemoBusiness;
  tasks: Task[];
  goals: Goal[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
  documents: DemoDocument[];
  proposals: DemoProposal[];
  completionRequests: DemoCompletionRequest[];
};

type DemoWorkspace = {
  user: DemoUser;
  businessId: string;
  membership: {
    business_id: string;
    role: "owner";
    businesses: DemoBusiness;
  };
};

export type DemoTaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  priority: Priority;
  status: TaskStatus;
  goalId: string | null;
};

export type DemoGoalInput = {
  title: string;
  description?: string;
  targetDate?: string;
};

const globalForDemo = globalThis as typeof globalThis & {
  __businessCopilotDemoState?: DemoState;
};

export function isDemoMode() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_MODE === "true"
  );
}

export function getDemoWorkspace(): DemoWorkspace {
  const state = getDemoState();
  return {
    user: state.user,
    businessId: state.business.id,
    membership: {
      business_id: state.business.id,
      role: "owner",
      businesses: state.business,
    },
  };
}

export function getDemoProfile() {
  const state = getDemoState();
  return mapStoredBusinessProfile({
    business: state.business as unknown as Record<string, unknown>,
  });
}

export function getDemoAccountName() {
  return getDemoState().profile.full_name;
}

export function saveDemoProfile(input: ProfileInput) {
  const state = getDemoState();
  Object.assign(state.business, profileToLegacyColumns(input));
  state.business.profile_details = {
    basics: input.basics,
    offerings: input.offerings,
    customers: input.customers,
    performance: input.performance,
    operations: input.operations,
    goals: input.goals,
    advice: input.advice,
    legacyAdditionalInformation: input.legacyAdditionalInformation,
  };
  state.business.business_snapshot = buildBusinessSnapshot(input);
  const primaryGoal = input.goals.primaryGoal
    ? state.goals.find((goal) => goal.id === state.business.primary_goal_id) ||
      state.goals.find(
        (goal) =>
          goal.title.toLowerCase() === input.goals.primaryGoal.toLowerCase(),
      ) ||
      saveDemoGoal({
        title: input.goals.primaryGoal,
        description: input.goals.successDefinition,
        targetDate: input.goals.targetDate,
      })
    : null;
  state.business.primary_goal_id = primaryGoal?.id || null;
}

export function saveDemoAccountName(name: string) {
  getDemoState().profile.full_name = name;
}

export function getDemoAIPrivacySettings(): AIPrivacySettings {
  const business = getDemoState().business;
  return {
    workspaceContextEnabled:
      business.ai_workspace_context_enabled ??
      DEFAULT_AI_PRIVACY_SETTINGS.workspaceContextEnabled,
    crossConversationEnabled:
      business.ai_cross_conversation_enabled ??
      DEFAULT_AI_PRIVACY_SETTINGS.crossConversationEnabled,
    documentSearchEnabled:
      business.ai_document_search_enabled ??
      DEFAULT_AI_PRIVACY_SETTINGS.documentSearchEnabled,
  };
}

export function saveDemoAIPrivacySettings(settings: AIPrivacySettings) {
  const business = getDemoState().business;
  business.ai_workspace_context_enabled = settings.workspaceContextEnabled;
  business.ai_cross_conversation_enabled = settings.crossConversationEnabled;
  business.ai_document_search_enabled = settings.documentSearchEnabled;
  return settings;
}

export function listDemoConversations() {
  return [...getDemoState().conversations].sort(
    (left, right) =>
      right.updated_at.localeCompare(left.updated_at) ||
      left.title.localeCompare(right.title),
  );
}

export function getDemoConversation(id: string) {
  return getDemoState().conversations.find(
    (conversation) => conversation.id === id,
  );
}

export function deleteDemoConversation(id: string) {
  const state = getDemoState();
  const exists = state.conversations.some((item) => item.id === id);
  if (!exists) return false;
  state.conversations = state.conversations.filter((item) => item.id !== id);
  state.messages = state.messages.filter((item) => item.conversation_id !== id);
  state.proposals = state.proposals.filter(
    (item) => item.conversation_id !== id,
  );
  state.completionRequests = state.completionRequests.filter(
    (item) => item.conversation_id !== id,
  );
  return true;
}

export function listDemoConversationMessages(id: string) {
  return getDemoState()
    .messages.filter((message) => message.conversation_id === id)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function startDemoConversation(title: string) {
  const state = getDemoState();
  const now = isoNow();
  const conversation: DemoConversation = {
    id: crypto.randomUUID(),
    title,
    business_id: state.business.id,
    created_by: state.user.id,
    updated_at: now,
    summary: null,
    summarized_message_count: 0,
    summary_updated_at: null,
  };
  state.conversations.unshift(conversation);
  return conversation;
}

export function addDemoMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown> | null;
}) {
  const state = getDemoState();
  const message: DemoMessage = {
    id: crypto.randomUUID(),
    conversation_id: input.conversationId,
    business_id: state.business.id,
    role: input.role,
    content: input.content,
    metadata: input.metadata || null,
    created_at: isoNow(),
  };
  state.messages.push(message);
  touchConversation(input.conversationId);
  return message;
}

export function renameDemoConversation(id: string, title: string) {
  const conversation = getDemoConversation(id);
  if (!conversation) return null;
  conversation.title = title;
  conversation.updated_at = isoNow();
  return conversation;
}

export function getDemoTasksAndGoals() {
  const state = getDemoState();
  return {
    tasks: [...state.tasks].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    ),
    goals: [...state.goals].sort((left, right) =>
      right.created_at.localeCompare(left.created_at),
    ),
  };
}

export function saveDemoTask(input: DemoTaskInput & { id?: string }) {
  const state = getDemoState();
  const now = isoNow();
  if (input.id) {
    const task = state.tasks.find((item) => item.id === input.id);
    if (!task) return null;
    task.title = input.title;
    task.description = normalize(input.description);
    task.due_date = input.dueDate || null;
    task.priority = input.priority;
    applyDemoTaskStatus(task, input.status, now);
    task.goal_id = input.goalId;
    task.updated_at = now;
    return cloneTask(task);
  }
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title,
    description: normalize(input.description),
    due_date: input.dueDate || null,
    priority: input.priority,
    status: input.status,
    completed_at: input.status === "completed" ? now : null,
    previous_incomplete_status: null,
    goal_id: input.goalId,
    origin: "manual",
    sort_order: state.tasks.length + 1,
    created_at: now,
    updated_at: now,
  };
  state.tasks.unshift(task);
  return cloneTask(task);
}

export function deleteDemoTask(id: string) {
  const state = getDemoState();
  const initial = state.tasks.length;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  return state.tasks.length !== initial;
}

export function saveDemoGoal(input: DemoGoalInput & { id?: string }) {
  const state = getDemoState();
  const now = isoNow();
  if (input.id) {
    const goal = state.goals.find((item) => item.id === input.id);
    if (!goal) return null;
    goal.title = input.title;
    goal.description = normalize(input.description);
    goal.updated_at = now;
    return cloneGoal(goal);
  }
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: input.title,
    description: normalize(input.description),
    target_date: input.targetDate || null,
    status: "incomplete",
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
  state.goals.unshift(goal);
  return cloneGoal(goal);
}

export function setDemoGoalCompletion({
  goalId,
  completed,
  completeRemainingTasks,
}: {
  goalId: string;
  completed: boolean;
  completeRemainingTasks: boolean;
}) {
  const state = getDemoState();
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return null;
  const now = isoNow();
  const changedTasks: Task[] = [];
  if (completed && completeRemainingTasks) {
    for (const task of state.tasks) {
      if (task.goal_id !== goalId || task.status === "completed") continue;
      applyDemoTaskStatus(task, "completed", now);
      task.updated_at = now;
      changedTasks.push(cloneTask(task));
    }
  }
  goal.status = completed ? "completed" : "incomplete";
  goal.completed_at = completed ? goal.completed_at || now : null;
  goal.updated_at = now;
  return { goal: cloneGoal(goal), tasks: changedTasks };
}

export function deleteDemoGoal(id: string) {
  const state = getDemoState();
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return false;
  state.goals = state.goals.filter((item) => item.id !== id);
  state.tasks = state.tasks.map((task) =>
    task.goal_id === id
      ? { ...task, goal_id: null, updated_at: isoNow() }
      : task,
  );
  return true;
}

export function listDemoDocuments() {
  return [...getDemoState().documents]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((document) => {
      const publicDocument = { ...document };
      delete publicDocument.extracted_text;
      return publicDocument;
    });
}

export function addDemoDocument(input: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: DemoDocument["status"];
  storagePath: string;
  errorMessage?: string | null;
}) {
  const state = getDemoState();
  const document: DemoDocument = {
    id: crypto.randomUUID(),
    business_id: state.business.id,
    uploaded_by: state.user.id,
    name: input.name,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    storage_path: input.storagePath,
    status: input.status,
    error_message: input.errorMessage || null,
    created_at: isoNow(),
  };
  state.documents.unshift(document);
  return document;
}

export function updateDemoDocument(
  id: string,
  patch: Partial<
    Pick<
      DemoDocument,
      "status" | "openai_file_id" | "vector_store_id" | "error_message"
    >
  >,
) {
  const document = getDemoState().documents.find((item) => item.id === id);
  if (!document) return null;
  Object.assign(document, patch);
  return document;
}

export function deleteDemoDocument(id: string) {
  const state = getDemoState();
  const initial = state.documents.length;
  state.documents = state.documents.filter((item) => item.id !== id);
  return state.documents.length !== initial;
}

export function createDemoProposal(input: {
  conversationId: string;
  createdBy: string;
  idempotencyKey: string;
  payload: TaskPlan;
}) {
  const state = getDemoState();
  const existing = state.proposals.find(
    (proposal) =>
      proposal.business_id === state.business.id &&
      proposal.idempotency_key === input.idempotencyKey &&
      ["proposed", "approved"].includes(proposal.status),
  );
  if (existing) return existing;
  const proposal: DemoProposal = {
    id: crypto.randomUUID(),
    business_id: state.business.id,
    conversation_id: input.conversationId,
    created_by: input.createdBy,
    idempotency_key: input.idempotencyKey,
    status: "proposed",
    payload: input.payload,
    approved_goal_id: null,
    approved_task_ids: null,
  };
  state.proposals.unshift(proposal);
  return proposal;
}

export function getDemoProposal(id: string) {
  return getDemoState().proposals.find((proposal) => proposal.id === id);
}

export function createDemoCompletionRequest(input: {
  conversationId: string;
  taskId: string;
  idempotencyKey: string;
  confirmationText: string;
}) {
  const state = getDemoState();
  const task = state.tasks.find(
    (item) => item.id === input.taskId && item.status !== "completed",
  );
  if (!task) return null;
  const existing = state.completionRequests.find(
    (request) =>
      request.business_id === state.business.id &&
      request.idempotency_key === input.idempotencyKey &&
      ["proposed", "approved"].includes(request.status),
  );
  if (existing) return existing;
  const request: DemoCompletionRequest = {
    id: crypto.randomUUID(),
    business_id: state.business.id,
    conversation_id: input.conversationId,
    task_id: task.id,
    created_by: state.user.id,
    idempotency_key: input.idempotencyKey,
    status: "proposed",
    confirmation_text: input.confirmationText,
    created_at: isoNow(),
    approved_at: null,
  };
  state.completionRequests.unshift(request);
  return request;
}

export function getDemoCompletionRequest(id: string) {
  return getDemoState().completionRequests.find((request) => request.id === id);
}

export function approveDemoCompletionRequest(id: string) {
  const state = getDemoState();
  const request = state.completionRequests.find((item) => item.id === id);
  if (!request) return null;
  const task = state.tasks.find((item) => item.id === request.task_id);
  if (!task) return null;
  if (request.status === "approved")
    return { alreadyApproved: true, task: cloneTask(task) };
  if (request.status !== "proposed") return null;
  const now = isoNow();
  applyDemoTaskStatus(task, "completed", now);
  task.updated_at = now;
  request.status = "approved";
  request.approved_at = now;
  return { alreadyApproved: false, task: cloneTask(task) };
}

export function getDemoPendingActions(conversationId: string) {
  const state = getDemoState();
  const proposal = state.proposals.find(
    (item) =>
      item.conversation_id === conversationId && item.status === "proposed",
  );
  const completionRequest = state.completionRequests.find(
    (item) =>
      item.conversation_id === conversationId && item.status === "proposed",
  );
  const task = completionRequest
    ? state.tasks.find((item) => item.id === completionRequest.task_id)
    : null;
  return {
    proposal: proposal ? { id: proposal.id, ...proposal.payload } : null,
    completionProposal:
      completionRequest && task && task.status !== "completed"
        ? {
            id: completionRequest.id,
            confirmationText: completionRequest.confirmation_text,
            task: { id: task.id, title: task.title, status: task.status },
          }
        : null,
  };
}

export function approveDemoProposal(id: string) {
  const state = getDemoState();
  const proposal = state.proposals.find((item) => item.id === id);
  if (!proposal) return null;
  if (proposal.status === "approved" && proposal.approved_goal_id) {
    const goal = state.goals.find(
      (item) => item.id === proposal.approved_goal_id,
    );
    const tasks = (proposal.approved_task_ids || [])
      .map((taskId) => state.tasks.find((task) => task.id === taskId))
      .filter(Boolean)
      .map((task) => cloneTask(task as Task));
    return {
      alreadyApproved: true,
      goal: goal ? cloneGoal(goal) : null,
      tasks,
    };
  }
  const goal =
    state.goals.find((item) => item.title === proposal.payload.goal.title) ||
    saveDemoGoal({
      title: proposal.payload.goal.title,
      description: proposal.payload.goal.description || "",
      targetDate: proposal.payload.goal.targetDate || undefined,
    });
  if (!goal) return null;
  const tasks = proposal.payload.tasks.map((task) =>
    saveDemoTask({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || "",
      priority: task.priority,
      status: "todo",
      goalId: goal.id,
    } as DemoTaskInput & { id?: string }),
  );
  proposal.status = "approved";
  proposal.approved_goal_id = goal.id;
  proposal.approved_task_ids = tasks.filter(Boolean).map((task) => task!.id);
  return {
    alreadyApproved: false,
    goal,
    tasks: tasks.filter(Boolean),
  };
}

export function getDemoAIData() {
  const state = getDemoState();
  return {
    business: state.business,
    profile: getDemoProfile(),
    goals: state.goals.map(cloneGoal),
    tasks: state.tasks.map(cloneTask),
    conversations: state.conversations.map((conversation) => ({
      ...conversation,
      summary: conversation.summary
        ? structuredClone(conversation.summary)
        : null,
    })),
    messages: state.messages.map((message) => ({ ...message })),
    documents: state.documents.map((document) => ({ ...document })),
  };
}

export function resetDemoState() {
  globalForDemo.__businessCopilotDemoState = createSeedState();
}

export function generateDemoConsultation(input: {
  message: string;
  conversationId?: string;
}) {
  const state = getDemoState();
  const conversation =
    input.conversationId && getDemoConversation(input.conversationId)
      ? getDemoConversation(input.conversationId)!
      : startDemoConversation(demoConversationTitle(input.message));
  const userMessage = addDemoMessage({
    conversationId: conversation.id,
    role: "user",
    content: input.message,
  });
  const proposal = shouldCreatePlan(input.message)
    ? createDemoProposal({
        conversationId: conversation.id,
        createdBy: state.user.id,
        idempotencyKey: `${conversation.id}:${hashLike(input.message)}`,
        payload: buildDemoPlan(input.message, state.business.name),
      })
    : null;
  const assistantContent = proposal
    ? "I drafted a practical action plan for your approval."
    : demoReply(input.message, state.business);
  const assistantMessage = addDemoMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantContent,
    metadata: proposal ? { proposal_id: proposal.id } : null,
  });
  if (!input.conversationId) {
    renameDemoConversation(
      conversation.id,
      demoConversationTitle(input.message),
    );
  }
  return {
    conversationId: conversation.id,
    title: conversation.title,
    userMessage,
    assistantMessage,
    proposal: proposal ? { id: proposal.id, ...proposal.payload } : null,
  };
}

function getDemoState() {
  if (!globalForDemo.__businessCopilotDemoState)
    globalForDemo.__businessCopilotDemoState = createSeedState();
  return globalForDemo.__businessCopilotDemoState;
}

function createSeedState(): DemoState {
  const businessId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = Date.now();
  const iso = (offsetMinutes: number) =>
    new Date(now - offsetMinutes * 60_000).toISOString();
  const futureDate = (days: number) =>
    new Date(now + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fullProfile = profileSchema.parse({
    businessName: "Sunrise Bakery & Café",
    basics: {
      industry: "Food and beverage",
      description:
        "A neighborhood bakery and café producing artisan pastries, espresso drinks, breakfast and lunch items, plus small corporate catering orders.",
      location: "Sellwood-Moreland neighborhood, Portland, Oregon",
      yearsInBusiness: 7,
      stage: "established",
      businessStructure: "physical",
      legalStructure: "llc",
      employees: 11,
      website: "https://sunrise-bakery.example",
    },
    offerings: {
      main: [
        "Fresh pastries and breads",
        "Espresso and tea drinks",
        "Breakfast and lunch sandwiches",
        "Corporate catering trays",
        "Online pre-orders",
      ],
      typicalPriceRange:
        "$4–$8 pastries, $5–$7 drinks, $12–$16 lunch, and $45–$95 catering trays",
      bestSeller: "Almond croissant and latte combination",
      revenueModels: ["one_time", "contracts"],
      salesChannels: ["storefront", "website", "social_media", "direct_sales"],
    },
    customers: {
      idealCustomer:
        "Nearby professionals and parents ages 28–55 who value locally made food, friendly service, and a convenient premium breakfast or lunch.",
      locations:
        "Primarily within three miles of the café, with catering customers across inner southeast Portland.",
      discoveryChannels: ["walk_in", "referrals", "search", "social"],
      whyChoose:
        "Customers consistently mention product freshness, staff warmth, and seasonal menu variety.",
      competitors: [
        "Riverbend Coffee",
        "Oak Street Bakeshop",
        "National coffee chains",
      ],
      differentiation:
        "Pastries are baked on site each morning, the menu rotates seasonally, and regular customers receive highly personal service.",
    },
    performance: {
      monthlyRevenueRange: "50k_100k",
      monthlyExpensesRange: "25k_50k",
      averageSalesPerMonth: "over_1000",
      averageTransactionValue: "10_24",
      mostProfitableOffering: "Corporate breakfast catering trays",
      recentTrend: "stable",
      metricsTracked: [
        "sales",
        "profit",
        "repeat_customers",
        "website_traffic",
      ],
    },
    operations: {
      tools: [
        "Toast POS",
        "QuickBooks Online",
        "Homebase scheduling",
        "Mailchimp",
        "Google Sheets production log",
      ],
      responsibilities:
        "Owner Maya handles finance, vendors, and marketing; the bakery lead manages production and food safety; the café manager handles scheduling and service; two shift leads oversee daily opening and closing.",
      growthLimitations: ["time", "staff", "money", "knowledge"],
      seasonalPeriods:
        "Holiday catering is busiest from mid-November through December. Summer weekends are strong, while January and February are slower.",
      timeConsumingWork:
        "Weekly production forecasting, last-minute schedule changes, manual catering quotes, and reconciling waste notes.",
    },
    goals: {
      primaryGoal:
        "Increase Monday–Thursday revenue between 2 p.m. and 5 p.m. by 15%",
      targetDate: "2026-10-31",
      successDefinition:
        "Reach an average of $1,150 in weekday afternoon revenue for four consecutive weeks without reducing gross margin below 64%.",
      biggestObstacle:
        "The bakery has limited marketing time and cannot rely on deep discounts because ingredient and labor costs are already rising.",
      triedStrategies: [
        {
          strategy:
            "Posted an afternoon pastry photo on Instagram twice per week for one month.",
          result:
            "Engagement increased, but the owner did not see a measurable lift in afternoon transactions.",
        },
        {
          strategy:
            "Tested a blanket 10% discount from 2 p.m. to 4 p.m. for two weeks.",
          result:
            "Transactions increased about 6%, but margin fell enough that the owner stopped the discount.",
        },
      ],
      availableResources:
        "Up to $600 per month, about six owner-hours per week, support from one shift lead, Toast sales reports, and an email list of 1,850 customers.",
      excludedSolutions: [
        "Deep storewide discounts",
        "Adding a third-party delivery marketplace",
        "Extending closing hours",
      ],
    },
    advice: {
      helpAreas: [
        "marketing",
        "operations",
        "finances",
        "customer_retention",
        "strategy",
      ],
      detailLevel: "step_by_step",
      ambition: "balanced",
      hoursPerWeek: 6,
      primaryPriority: "profitability",
    },
    legacyAdditionalInformation: "",
  });
  const legacy = profileToLegacyColumns(fullProfile);
  const business: DemoBusiness = {
    id: businessId,
    name: legacy.name,
    legal_structure: legacy.legal_structure,
    industry: legacy.industry,
    website: legacy.website,
    location: legacy.location,
    year_founded: legacy.year_founded,
    employee_count: legacy.employee_count,
    description: legacy.description,
    products_services: legacy.products_services,
    target_customers: legacy.target_customers,
    business_model: legacy.business_model,
    organization: legacy.organization,
    current_goals: legacy.current_goals,
    current_challenges: legacy.current_challenges,
    competitive_advantages: legacy.competitive_advantages,
    annual_revenue: "Fictional estimate: $720,000–$840,000",
    fixed_costs:
      "Payroll, rent, insurance, equipment leases, and software subscriptions.",
    variable_costs:
      "Flour, butter, dairy, coffee beans, proteins, produce, and packaging.",
    pricing_info: legacy.pricing_info,
    budget_constraints:
      "The owner can invest about $600 monthly and wants experiments to pay back within 90 days.",
    financial_notes:
      "All figures in this example workspace are fictional ranges created for product testing.",
    vector_store_id: null,
    profile_details: {
      basics: fullProfile.basics,
      offerings: fullProfile.offerings,
      customers: fullProfile.customers,
      performance: fullProfile.performance,
      operations: fullProfile.operations,
      goals: fullProfile.goals,
      advice: fullProfile.advice,
      legacyAdditionalInformation: fullProfile.legacyAdditionalInformation,
    },
    business_snapshot: {
      ...buildBusinessSnapshot(fullProfile),
      exampleDocumentInsights: [
        {
          source: "Q2 daypart sales.csv",
          finding:
            "Monday–Thursday from 2–5 p.m. averages 34 transactions and $482 revenue per day; the average ticket is $14.18.",
        },
        {
          source: "Product margin notes.txt",
          finding:
            "Catering trays average 62% gross margin. Laminated pastries account for 31% of recorded food waste and prepared sandwiches account for 24%.",
        },
      ],
    },
    primary_goal_id: null,
  };
  const goal1: Goal = {
    id: crypto.randomUUID(),
    title: "Increase weekday afternoon revenue by 15%",
    description:
      "Improve Monday–Thursday revenue from 2–5 p.m. without lowering gross margin below 64%.",
    target_date: "2026-10-31",
    status: "incomplete",
    completed_at: null,
    created_at: iso(22_000),
    updated_at: iso(45),
  };
  const goal2: Goal = {
    id: crypto.randomUUID(),
    title: "Reduce ingredient waste to 4% of purchases",
    description:
      "Improve production forecasting and reuse safe surplus ingredients.",
    target_date: futureDate(90),
    status: "incomplete",
    completed_at: null,
    created_at: iso(18_000),
    updated_at: iso(720),
  };
  const goal3: Goal = {
    id: crypto.randomUUID(),
    title: "Launch a corporate catering pilot",
    description:
      "Win five repeat office catering customers without disrupting café service.",
    target_date: futureDate(120),
    status: "incomplete",
    completed_at: null,
    created_at: iso(12_000),
    updated_at: iso(1_440),
  };
  const goal4: Goal = {
    id: crypto.randomUUID(),
    title: "Improve local search visibility",
    description:
      "Refresh the Google Business profile and establish a review-response routine.",
    target_date: null,
    status: "completed",
    completed_at: iso(4_320),
    created_at: iso(30_000),
    updated_at: iso(4_320),
  };
  business.primary_goal_id = goal1.id;
  const tasks: Task[] = [
    {
      id: crypto.randomUUID(),
      title: "Design a margin-safe afternoon bundle",
      description:
        "Pair one high-margin drink with a pastry that has predictable afternoon surplus.",
      due_date: futureDate(7),
      priority: "high",
      status: "todo",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal1.id,
      origin: "ai",
      sort_order: 1,
      created_at: iso(1_400),
      updated_at: iso(45),
    },
    {
      id: crypto.randomUUID(),
      title: "Segment the email list by visit behavior",
      description:
        "Identify regulars who purchase before noon and invite them to test the afternoon offer.",
      due_date: futureDate(10),
      priority: "high",
      status: "in_progress",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal1.id,
      origin: "manual",
      sort_order: 2,
      created_at: iso(1_350),
      updated_at: iso(60),
    },
    {
      id: crypto.randomUUID(),
      title: "Establish the weekday afternoon baseline",
      description:
        "Export eight weeks of 2–5 p.m. revenue, transaction count, and average ticket data from Toast.",
      due_date: futureDate(-3),
      priority: "high",
      status: "completed",
      completed_at: iso(180),
      previous_incomplete_status: "in_progress",
      goal_id: goal1.id,
      origin: "manual",
      sort_order: 3,
      created_at: iso(1_500),
      updated_at: iso(180),
    },
    {
      id: crypto.randomUUID(),
      title: "Track daily waste by category for two weeks",
      description:
        "Log production quantity, units sold, donated items, and discarded items.",
      due_date: futureDate(14),
      priority: "medium",
      status: "in_progress",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal2.id,
      origin: "manual",
      sort_order: 4,
      created_at: iso(2_800),
      updated_at: iso(600),
    },
    {
      id: crypto.randomUUID(),
      title: "Set weekly par levels for top 12 products",
      description:
        "Use weekday and weekend demand separately when setting production targets.",
      due_date: futureDate(21),
      priority: "medium",
      status: "todo",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal2.id,
      origin: "ai",
      sort_order: 5,
      created_at: iso(2_700),
      updated_at: iso(700),
    },
    {
      id: crypto.randomUUID(),
      title: "Calculate waste as a percentage of purchases",
      description:
        "Create a repeatable weekly baseline before changing production quantities.",
      due_date: futureDate(-14),
      priority: "medium",
      status: "completed",
      completed_at: iso(2_160),
      previous_incomplete_status: "todo",
      goal_id: goal2.id,
      origin: "manual",
      sort_order: 6,
      created_at: iso(4_000),
      updated_at: iso(2_160),
    },
    {
      id: crypto.randomUUID(),
      title: "Interview five office managers",
      description:
        "Ask about order size, dietary needs, delivery expectations, and ordering frequency.",
      due_date: futureDate(30),
      priority: "medium",
      status: "todo",
      completed_at: null,
      previous_incomplete_status: null,
      goal_id: goal3.id,
      origin: "manual",
      sort_order: 7,
      created_at: iso(1_800),
      updated_at: iso(1_400),
    },
    {
      id: crypto.randomUUID(),
      title: "Publish updated Google Business photos",
      description:
        "Replace outdated storefront and menu images with current professional photos.",
      due_date: futureDate(-45),
      priority: "low",
      status: "completed",
      completed_at: iso(4_500),
      previous_incomplete_status: "todo",
      goal_id: goal4.id,
      origin: "manual",
      sort_order: 8,
      created_at: iso(8_000),
      updated_at: iso(4_500),
    },
  ];
  const afternoonConversationId = crypto.randomUUID();
  const wasteConversationId = crypto.randomUUID();
  const cateringConversationId = crypto.randomUUID();
  const afternoonSummary: ConversationSummary = {
    confirmedFacts: [
      "Monday–Thursday 2–5 p.m. averages 34 transactions and $482 revenue per day.",
      "The owner stopped a blanket 10% discount because the margin impact was too high.",
    ],
    decisions: ["Test a targeted bundle rather than a storewide discount."],
    goalsAndConstraints: [
      "Increase weekday afternoon revenue 15% while keeping gross margin at or above 64%.",
      "The monthly experiment budget is $600.",
    ],
    recommendedStrategies: [
      "Create a high-margin afternoon bundle and target existing morning customers.",
    ],
    confirmedActionsTried: [
      "Posted afternoon product photos twice weekly for one month.",
      "Ran a blanket 10% afternoon discount for two weeks.",
    ],
    confirmedResults: [
      "Social engagement increased without a measurable transaction lift.",
      "Discount-period transactions rose about 6%, but margin declined.",
    ],
    unresolvedQuestions: [
      "Which pastry has both strong margin and predictable afternoon surplus?",
    ],
  };
  const wasteSummary: ConversationSummary = {
    confirmedFacts: [
      "Laminated pastries account for 31% of logged waste.",
      "Prepared sandwiches account for 24% of logged waste.",
    ],
    decisions: ["Track waste for two more weeks before reducing par levels."],
    goalsAndConstraints: [
      "Reduce waste to 4% of purchases without increasing stockouts.",
    ],
    recommendedStrategies: [
      "Separate weekday and weekend par levels for the highest-waste products.",
    ],
    confirmedActionsTried: ["Calculated the initial weekly waste percentage."],
    confirmedResults: ["The initial baseline was approximately 7%."],
    unresolvedQuestions: ["How much waste occurs by day of week?"],
  };
  const cateringSummary: ConversationSummary = {
    confirmedFacts: [
      "Corporate breakfast trays average approximately 62% gross margin.",
      "The current quote process is manual.",
    ],
    decisions: ["Start with a five-customer pilot."],
    goalsAndConstraints: [
      "Avoid disrupting morning café production and counter service.",
    ],
    recommendedStrategies: [
      "Interview office managers before finalizing packages and minimums.",
    ],
    confirmedActionsTried: [],
    confirmedResults: [],
    unresolvedQuestions: [
      "What delivery window and minimum order will target offices accept?",
    ],
  };
  return {
    user: {
      id: userId,
      email: "maya@sunrise-bakery.example",
    },
    profile: {
      full_name: "Maya Chen",
    },
    business,
    goals: [goal1, goal2, goal3, goal4],
    tasks,
    conversations: [
      {
        id: afternoonConversationId,
        title: "Weekday Afternoon Growth",
        business_id: businessId,
        created_by: userId,
        updated_at: iso(10),
        summary: afternoonSummary,
        summarized_message_count: 2,
        summary_updated_at: iso(10),
      },
      {
        id: wasteConversationId,
        title: "Reducing Bakery Waste",
        business_id: businessId,
        created_by: userId,
        updated_at: iso(1_420),
        summary: wasteSummary,
        summarized_message_count: 2,
        summary_updated_at: iso(1_420),
      },
      {
        id: cateringConversationId,
        title: "Corporate Catering Pilot",
        business_id: businessId,
        created_by: userId,
        updated_at: iso(2_860),
        summary: cateringSummary,
        summarized_message_count: 2,
        summary_updated_at: iso(2_860),
      },
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        conversation_id: afternoonConversationId,
        business_id: businessId,
        role: "user",
        content:
          "Our 10% afternoon discount increased transactions a little but hurt margin. What should we test next?",
        created_at: iso(12),
        metadata: null,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: afternoonConversationId,
        business_id: businessId,
        role: "assistant",
        content:
          "Use a targeted bundle built around a high-margin drink and predictable pastry surplus, then promote it only to customers who normally visit before noon. Measure revenue, transactions, average ticket, and bundle margin against the eight-week baseline.",
        created_at: iso(11),
        metadata: null,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: wasteConversationId,
        business_id: businessId,
        role: "user",
        content:
          "Our first waste calculation was about 7% of purchases. Laminated pastries and sandwiches are the biggest categories.",
        created_at: iso(1_430),
        metadata: null,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: wasteConversationId,
        business_id: businessId,
        role: "assistant",
        content:
          "Keep two more weeks of day-level data before changing production. Then set separate weekday and weekend par levels for the highest-waste products and watch stockouts alongside waste.",
        created_at: iso(1_425),
        metadata: null,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: cateringConversationId,
        business_id: businessId,
        role: "user",
        content:
          "Could a small corporate catering program become a reliable second revenue stream?",
        created_at: iso(2_870),
        metadata: null,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: cateringConversationId,
        business_id: businessId,
        role: "assistant",
        content:
          "The current 62% tray margin is encouraging, but validate demand and operational fit before expanding. Interview five office managers, define two fixed packages, and test a limited delivery radius.",
        created_at: iso(2_865),
        metadata: null,
      },
    ],
    documents: [
      {
        id: crypto.randomUUID(),
        business_id: businessId,
        uploaded_by: userId,
        name: "Q2 daypart sales.csv",
        mime_type: "text/csv",
        size_bytes: 4_812,
        storage_path: "demo/q2-daypart-sales.csv",
        status: "ready",
        created_at: iso(5_000),
        error_message: null,
        extracted_text:
          "Fictional Q2 summary: Monday–Thursday 2–5 p.m. averages 34 transactions and $482 revenue per day. Average ticket is $14.18. Friday afternoon averages $711. Weekend afternoon averages $846.",
      },
      {
        id: crypto.randomUUID(),
        business_id: businessId,
        uploaded_by: userId,
        name: "Product margin notes.txt",
        mime_type: "text/plain",
        size_bytes: 2_106,
        storage_path: "demo/product-margin-notes.txt",
        status: "ready",
        created_at: iso(4_800),
        error_message: null,
        extracted_text:
          "Fictional product notes: Corporate breakfast trays average 62% gross margin. Espresso drinks average 74%. Laminated pastries are 31% of recorded food waste; prepared sandwiches are 24%.",
      },
    ],
    proposals: [],
    completionRequests: [],
  };
}

function touchConversation(id: string) {
  const conversation = getDemoConversation(id);
  if (conversation) conversation.updated_at = isoNow();
}

function demoReply(message: string, business: DemoBusiness) {
  const text = message.toLowerCase();
  if (text.includes("weekday") && text.includes("sales")) {
    return `For ${business.name}, I would focus on a small weekday offer, a 2 to 4 p.m. promotion, and one repeat-visit incentive so you can test demand without adding much overhead.`;
  }
  if (text.includes("cost")) {
    return `The fastest cost levers for ${business.name} are labor scheduling, waste control, and bundle pricing. I would measure each one for a week before changing anything permanent.`;
  }
  if (text.includes("retention")) {
    return `For retention, tighten the post-purchase experience, create one follow-up offer, and identify the highest-value customer segment before you spend on broader marketing.`;
  }
  return `Based on ${business.name} and the current context, I would break this into a few low-risk experiments, define a clear success metric, and run the smallest test that can answer the question.`;
}

function shouldCreatePlan(message: string) {
  return (
    /\b(create|build|make|add|save)\b/i.test(message) &&
    /\b(task|tasks|plan|action plan)\b/i.test(message)
  );
}

function buildDemoPlan(message: string, businessName: string): TaskPlan {
  const normalized = message.toLowerCase();
  if (normalized.includes("sales")) {
    return {
      goal: {
        title: "Increase Weekday Sales",
        description: `Build low-risk promotions to improve weekday traffic for ${businessName}.`,
        targetDate: undefined,
      },
      tasks: [
        {
          title: "Test a weekday combo offer",
          description:
            "Create one discounted drink-and-pastry bundle for slow hours.",
          dueDate: undefined,
          priority: "high",
          order: 0,
        },
        {
          title: "Schedule one afternoon promotion",
          description:
            "Promote the bundle to regular customers by email or SMS.",
          dueDate: undefined,
          priority: "medium",
          order: 1,
        },
        {
          title: "Measure traffic and ticket size",
          description: "Compare afternoon traffic against the prior two weeks.",
          dueDate: undefined,
          priority: "medium",
          order: 2,
        },
      ],
    };
  }
  if (normalized.includes("cost")) {
    return {
      goal: {
        title: "Reduce Operating Costs",
        description: `Trim avoidable expenses without hurting service quality at ${businessName}.`,
        targetDate: undefined,
      },
      tasks: [
        {
          title: "Review labor coverage by hour",
          description: "Match staffing to the slowest periods of the week.",
          dueDate: undefined,
          priority: "high",
          order: 0,
        },
        {
          title: "Track top three waste categories",
          description: "Record avoidable waste for one full business cycle.",
          dueDate: undefined,
          priority: "medium",
          order: 1,
        },
        {
          title: "List vendors for price comparison",
          description: "Review one replacement option for each major input.",
          dueDate: undefined,
          priority: "low",
          order: 2,
        },
      ],
    };
  }
  return {
    goal: {
      title: fallbackTitle(message).replace(/[?.!]+$/, ""),
      description: `A practical action plan based on the request: ${message}.`,
      targetDate: undefined,
    },
    tasks: [
      {
        title: "Clarify the target outcome",
        description:
          "Write down what success should look like in one sentence.",
        dueDate: undefined,
        priority: "medium",
        order: 0,
      },
      {
        title: "Collect the key facts",
        description:
          "Gather the numbers or customer feedback needed to decide.",
        dueDate: undefined,
        priority: "medium",
        order: 1,
      },
      {
        title: "Run one small test",
        description:
          "Choose the smallest experiment that can validate the idea.",
        dueDate: undefined,
        priority: "low",
        order: 2,
      },
    ],
  };
}

function demoConversationTitle(message: string) {
  return fallbackTitle(message).replace(/[?.!]+$/, "") || "New consultation";
}

function hashLike(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

function cloneTask(task: Task): Task {
  return { ...task };
}

function cloneGoal(goal: Goal): Goal {
  return { ...goal };
}

function normalize(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function applyDemoTaskStatus(
  task: Task,
  status: TaskStatus,
  completedAt: string,
) {
  if (status === "completed") {
    if (task.status !== "completed") {
      task.previous_incomplete_status = task.status;
      task.completed_at = completedAt;
    }
  } else {
    task.completed_at = null;
  }
  task.status = status;
}

function isoNow() {
  return new Date().toISOString();
}
