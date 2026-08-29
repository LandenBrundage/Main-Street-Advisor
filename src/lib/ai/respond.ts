import type OpenAI from "openai";
import { RETRIEVAL_TOOL_NAMES, retrievalTools } from "@/lib/ai/retrieval-tools";
import { AI_MAX_OUTPUT_TOKENS } from "@/lib/config";
import {
  enforceResponseModeration,
  ModerationBlockedError,
  responseModerationConfig,
} from "@/lib/ai/moderation";
import { CONSULTANT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import {
  createTaskPlanTool,
  proposeTaskCompletionTool,
  suggestTaskPlanTool,
} from "@/lib/ai/tools";

export type ModelMessage = { role: "user" | "assistant"; content: string };
export type ConsultantActionCall = {
  callId: string;
  name: "create_task_plan" | "propose_task_completion" | "suggest_task_plan";
  arguments: string;
};
export type ConsultantResponse = OpenAI.Responses.Response & {
  actionCalls: ConsultantActionCall[];
  moderationBlocked?: "output";
};
export async function requestConsultantResponse({
  openai,
  model,
  context,
  messages,
  vectorStoreId,
  executeRetrieval,
  safetyIdentifier = "local-test-safety-id",
  allowActionTools = true,
  allowedRetrievalToolNames = RETRIEVAL_TOOL_NAMES,
}: {
  openai: OpenAI;
  model: string;
  context: string;
  messages: ModelMessage[];
  vectorStoreId?: string;
  executeRetrieval?: (name: string, rawArguments: string) => Promise<unknown>;
  safetyIdentifier?: string;
  allowActionTools?: boolean;
  allowedRetrievalToolNames?: ReadonlySet<string>;
}): Promise<ConsultantResponse> {
  const tools: OpenAI.Responses.Tool[] = [
    ...(allowActionTools
      ? [createTaskPlanTool, proposeTaskCompletionTool, suggestTaskPlanTool]
      : []),
    ...retrievalTools.filter(
      (tool) =>
        tool.type !== "function" || allowedRetrievalToolNames.has(tool.name),
    ),
    ...(vectorStoreId
      ? [
          {
            type: "file_search" as const,
            vector_store_ids: [vectorStoreId],
            max_num_results: 5,
          },
        ]
      : []),
  ];
  let input = messages as OpenAI.Responses.ResponseInput;
  const actionCalls = new Map<string, ConsultantActionCall>();
  let response: OpenAI.Responses.Response | null = null;

  for (let round = 0; round < 5; round += 1) {
    response = await openai.responses.create({
      model,
      instructions: `${CONSULTANT_SYSTEM_PROMPT}\n\n${context}`,
      input,
      tools,
      parallel_tool_calls: false,
      max_output_tokens: AI_MAX_OUTPUT_TOKENS,
      moderation: responseModerationConfig,
      safety_identifier: safetyIdentifier,
      store: false,
    });
    try {
      enforceResponseModeration(response);
    } catch (error) {
      if (error instanceof ModerationBlockedError && error.side === "output")
        return Object.assign(response, {
          actionCalls: [],
          moderationBlocked: "output" as const,
        });
      throw error;
    }
    const calls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );
    if (!calls.length)
      return Object.assign(response, {
        actionCalls: [...actionCalls.values()],
      });

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      if (
        call.name === "create_task_plan" ||
        call.name === "propose_task_completion" ||
        call.name === "suggest_task_plan"
      ) {
        actionCalls.set(call.call_id, {
          callId: call.call_id,
          name: call.name,
          arguments: call.arguments,
        });
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(
            call.name === "suggest_task_plan"
              ? {
                  status: "suggestion_control_available",
                  message:
                    "The application will offer an optional Create goal & tasks control. Continue the full recommendation without claiming that a plan was created.",
                }
              : {
                  status: "awaiting_user_confirmation",
                  message:
                    "The application prepared a confirmation action. Explain that nothing changes until the user approves it.",
                },
          ),
        });
        continue;
      }
      if (!allowedRetrievalToolNames.has(call.name) || !executeRetrieval) {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: "Tool unavailable" }),
        });
        continue;
      }
      try {
        const result = await executeRetrieval(call.name, call.arguments);
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      } catch {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            error:
              "The requested workspace information could not be retrieved.",
          }),
        });
      }
    }
    input = [
      ...input,
      ...(response.output as unknown as OpenAI.Responses.ResponseInput),
      ...outputs,
    ];
  }
  if (!response) throw new Error("OPENAI_EMPTY_RESPONSE");
  return Object.assign(response, { actionCalls: [...actionCalls.values()] });
}
