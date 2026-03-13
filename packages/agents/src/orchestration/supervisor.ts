import { Agent } from "../agent.js";
import type { ModelProvider } from "../llm/provider.js";
import type { ModelOptions } from "../llm/types.js";
import type { Tool } from "../tools/types.js";
import type { AgentContext } from "../types.js";

export type SupervisorConfig = {
  name: string;
  systemPrompt: string;
  provider: ModelProvider;
  model: ModelOptions;
  workers: Agent[];
  maxRounds?: number;
};

export function createSupervisor(config: SupervisorConfig): Agent {
  const workerMap = new Map(config.workers.map((w) => [w.name, w]));

  const delegateTool: Tool = {
    name: "delegate_to_worker",
    description: "Delegate a task to a specialized worker agent",
    parameters: {
      type: "object",
      properties: {
        worker: {
          type: "string",
          enum: config.workers.map((w) => w.name),
          description: "The worker agent to delegate to",
        },
        input: {
          type: "string",
          description: "The task input for the worker",
        },
      },
      required: ["worker", "input"],
    },
    execute: async (
      rawInput: unknown,
      ctx: AgentContext,
    ) => {
      const { worker, input } = rawInput as { worker: string; input: string };
      const target = workerMap.get(worker);
      if (!target) {
        throw new Error(`Unknown worker: "${worker}"`);
      }
      const result = await target.run(input, {
        requestId: ctx.runId,
        payload: ctx.payload,
        synkroCtx: ctx,
      });
      return result.output;
    },
  };

  const workerDescriptions = config.workers
    .map((w) => `- ${w.name}: ${w.description ?? "no description"}`)
    .join("\n");

  const enhancedSystemPrompt = `${config.systemPrompt}

You have the following worker agents available via the delegate_to_worker tool:
${workerDescriptions}

Delegate tasks to workers as needed. When the task is complete, provide a final summary without delegating.`;

  return new Agent({
    name: config.name,
    systemPrompt: enhancedSystemPrompt,
    provider: config.provider,
    model: config.model,
    tools: [delegateTool],
    maxIterations: config.maxRounds ?? 5,
  });
}
