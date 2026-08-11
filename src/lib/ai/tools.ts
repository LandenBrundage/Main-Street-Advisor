import { taskPlanSchema } from "@/lib/schemas";

export const createTaskPlanTool = {
  type: "function" as const,
  name: "create_task_plan",
  description:
    "Propose a goal and related tasks for user approval. Use only after an explicit request to create, add, or save tasks.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["goal", "tasks"],
    properties: {
      goal: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "targetDate"],
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          targetDate: { type: ["string", "null"] },
        },
      },
      tasks: {
        type: "array",
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "dueDate", "priority", "order"],
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            dueDate: { type: ["string", "null"] },
            priority: { type: "string", enum: ["na", "low", "medium", "high"] },
            order: { type: "integer" },
          },
        },
      },
    },
  },
};
export const proposeTaskCompletionTool = {
  type: "function" as const,
  name: "propose_task_completion",
  description:
    "Prepare a user confirmation action after the user explicitly says a specific existing task is complete. Never use this to update a task directly. Retrieve the task first when its ID or current status is uncertain.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["taskId", "confirmationText"],
    properties: {
      taskId: { type: "string", format: "uuid" },
      confirmationText: {
        type: "string",
        description:
          "A concise question asking the user to confirm marking this named task complete.",
      },
    },
  },
};
export function validateTaskPlan(value: unknown) {
  return taskPlanSchema.parse(value);
}
