import type OpenAI from "openai";
import { RETRIEVAL_TOOL_NAMES, retrievalTools } from "@/lib/ai/retrieval-tools";
import { CONSULTANT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { createTaskPlanTool, proposeTaskCompletionTool } from "@/lib/ai/tools";

export type ModelMessage = { role: "user" | "assistant"; content: string };
export type ConsultantActionCall = {
  callId: string;
  name: "create_task_plan" | "propose_task_completion";
  arguments: string;
};
export type ConsultantResponse = OpenAI.Responses.Response & {
  actionCalls: ConsultantActionCall[];
};
export async function requestConsultantResponse({
  openai,
  model,
  context,
  messages,
  vectorStoreId,
  executeRetrieval,
}: {
  openai: OpenAI;
  model: string;
  context: string;
  messages: ModelMessage[];
  vectorStoreId?: string;
  executeRetrieval?: (name: string, rawArguments: string) => Promise<unknown>;
}): Promise<ConsultantResponse> {
  const tools: OpenAI.Responses.Tool[] = [
    createTaskPlanTool,
    proposeTaskCompletionTool,
    ...retrievalTools,
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
      store: false,
    });
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
        call.name === "propose_task_completion"
      ) {
        actionCalls.set(call.call_id, {
          callId: call.call_id,
          name: call.name,
          arguments: call.arguments,
        });
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            status: "awaiting_user_confirmation",
            message:
              "The application prepared a confirmation action. Explain that nothing changes until the user approves it.",
          }),
        });
        continue;
      }
      if (!RETRIEVAL_TOOL_NAMES.has(call.name) || !executeRetrieval) {
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
