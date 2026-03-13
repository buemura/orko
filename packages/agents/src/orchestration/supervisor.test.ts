import { describe, it, expect, vi } from "vitest";
import { Agent } from "../agent.js";
import { createSupervisor } from "./supervisor.js";
import type { ModelProvider } from "../llm/provider.js";
import type { Message, ModelOptions, ModelResponse } from "../llm/types.js";

function createMockProvider(responses: ModelResponse[]): ModelProvider {
  let callIndex = 0;
  return {
    chat: vi.fn(async (_messages: Message[], _options: ModelOptions) => {
      const response = responses[callIndex];
      if (!response) {
        throw new Error("No more mock responses");
      }
      callIndex++;
      return response;
    }),
  };
}

const USAGE = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

describe("createSupervisor", () => {
  it("should return an Agent instance", () => {
    const provider = createMockProvider([]);
    const worker = new Agent({
      name: "worker-a",
      description: "Does task A",
      systemPrompt: "You are worker A.",
      provider: createMockProvider([]),
      model: { model: "test-model" },
    });

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "You are a supervisor.",
      provider,
      model: { model: "test-model" },
      workers: [worker],
    });

    expect(supervisor).toBeInstanceOf(Agent);
    expect(supervisor.name).toBe("supervisor");
  });

  it("should delegate to worker when LLM calls delegate_to_worker tool", async () => {
    const workerProvider = createMockProvider([
      { content: "Worker result", usage: USAGE, finishReason: "stop" },
    ]);
    const worker = new Agent({
      name: "coder",
      description: "Writes code",
      systemPrompt: "You are a coder.",
      provider: workerProvider,
      model: { model: "test-model" },
    });

    const supervisorProvider = createMockProvider([
      {
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "delegate_to_worker",
            arguments: '{"worker":"coder","input":"write a function"}',
          },
        ],
        usage: USAGE,
        finishReason: "tool_calls",
      },
      {
        content: "Task complete. Coder wrote the function.",
        usage: USAGE,
        finishReason: "stop",
      },
    ]);

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "You are a supervisor.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
    });

    const result = await supervisor.run("Write a sorting function");

    expect(result.status).toBe("completed");
    expect(result.output).toBe("Task complete. Coder wrote the function.");
    // Worker should have been called
    expect(workerProvider.chat).toHaveBeenCalled();
  });

  it("should return worker output as tool result to the supervisor", async () => {
    const workerProvider = createMockProvider([
      { content: "The answer is 42", usage: USAGE, finishReason: "stop" },
    ]);
    const worker = new Agent({
      name: "researcher",
      description: "Does research",
      systemPrompt: "You are a researcher.",
      provider: workerProvider,
      model: { model: "test-model" },
    });

    const supervisorChatFn = vi.fn()
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "delegate_to_worker",
            arguments: '{"worker":"researcher","input":"find the answer"}',
          },
        ],
        usage: USAGE,
        finishReason: "tool_calls",
      })
      .mockResolvedValueOnce({
        content: "Based on research: The answer is 42",
        usage: USAGE,
        finishReason: "stop",
      });

    const supervisorProvider: ModelProvider = { chat: supervisorChatFn };

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "You are a supervisor.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
    });

    const result = await supervisor.run("Find the answer");

    // The supervisor's second call should include the worker's output in messages
    const secondCallMessages = supervisorChatFn.mock.calls[1]![0] as Message[];
    const toolMessage = secondCallMessages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toContain("The answer is 42");
    expect(result.output).toBe("Based on research: The answer is 42");
  });

  it("should stop when LLM responds without tool calls", async () => {
    const worker = new Agent({
      name: "worker",
      description: "Does work",
      systemPrompt: "Worker.",
      provider: createMockProvider([]),
      model: { model: "test-model" },
    });

    const supervisorProvider = createMockProvider([
      {
        content: "I can handle this myself.",
        usage: USAGE,
        finishReason: "stop",
      },
    ]);

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "You are a supervisor.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
    });

    const result = await supervisor.run("Simple task");

    expect(result.status).toBe("completed");
    expect(result.output).toBe("I can handle this myself.");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("should surface error when unknown worker is specified", async () => {
    const worker = new Agent({
      name: "worker",
      description: "Does work",
      systemPrompt: "Worker.",
      provider: createMockProvider([]),
      model: { model: "test-model" },
    });

    const supervisorProvider = createMockProvider([
      {
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "delegate_to_worker",
            arguments: '{"worker":"nonexistent","input":"task"}',
          },
        ],
        usage: USAGE,
        finishReason: "tool_calls",
      },
      {
        content: "Worker not found.",
        usage: USAGE,
        finishReason: "stop",
      },
    ]);

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "You are a supervisor.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
    });

    const result = await supervisor.run("Do something");

    expect(result.toolCalls[0]!.error).toContain("nonexistent");
  });

  it("should default maxRounds to 5", async () => {
    // Worker always responds so supervisor keeps delegating
    const workerProvider = createMockProvider(
      Array.from({ length: 10 }, () => ({
        content: "done",
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );
    const worker = new Agent({
      name: "loop-worker",
      description: "Works",
      systemPrompt: "Worker.",
      provider: workerProvider,
      model: { model: "test-model" },
    });

    const supervisorProvider = createMockProvider(
      Array.from({ length: 10 }, () => ({
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "delegate_to_worker",
            arguments: '{"worker":"loop-worker","input":"task"}',
          },
        ],
        usage: USAGE,
        finishReason: "tool_calls" as const,
      })),
    );

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "Keep delegating.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
    });

    const result = await supervisor.run("Loop");

    expect(result.status).toBe("max_iterations");
    // Default maxRounds = 5, so exactly 5 tool calls
    expect(result.toolCalls).toHaveLength(5);
  });

  it("should respect custom maxRounds", async () => {
    const workerProvider = createMockProvider(
      Array.from({ length: 10 }, () => ({
        content: "done",
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );
    const worker = new Agent({
      name: "loop-worker",
      description: "Works",
      systemPrompt: "Worker.",
      provider: workerProvider,
      model: { model: "test-model" },
    });

    const supervisorProvider = createMockProvider(
      Array.from({ length: 10 }, () => ({
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "delegate_to_worker",
            arguments: '{"worker":"loop-worker","input":"task"}',
          },
        ],
        usage: USAGE,
        finishReason: "tool_calls" as const,
      })),
    );

    const supervisor = createSupervisor({
      name: "supervisor",
      systemPrompt: "Keep delegating.",
      provider: supervisorProvider,
      model: { model: "test-model" },
      workers: [worker],
      maxRounds: 2,
    });

    const result = await supervisor.run("Loop");

    expect(result.status).toBe("max_iterations");
    expect(result.toolCalls).toHaveLength(2);
  });
});
