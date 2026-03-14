import { describe, it, expect, vi } from "vitest";
import { Agent } from "../agent.js";
import { createDebate } from "./debate.js";
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

function createParticipant(
  name: string,
  responses: ModelResponse[],
): { agent: Agent; provider: ModelProvider } {
  const provider = createMockProvider(responses);
  const agent = new Agent({
    name,
    description: `${name} agent`,
    systemPrompt: `You are ${name}.`,
    provider,
    model: { model: "test-model" },
  });
  return { agent, provider };
}

describe("createDebate", () => {
  it("should throw when participants array is empty", () => {
    expect(() =>
      createDebate({ name: "empty-debate", participants: [] }),
    ).toThrow("Debate requires at least one participant");
  });

  it("should run a basic debate with 2 participants and 2 rounds", async () => {
    const { agent: alice } = createParticipant(
      "alice",
      Array.from({ length: 2 }, (_, i) => ({
        content: `Alice round ${i + 1}`,
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );
    const { agent: bob } = createParticipant(
      "bob",
      Array.from({ length: 2 }, (_, i) => ({
        content: `Bob round ${i + 1}`,
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );

    const debate = createDebate({
      name: "test-debate",
      participants: [alice, bob],
      maxRounds: 2,
    });

    const result = await debate.run("Tabs vs spaces");

    expect(result.status).toBe("completed");
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]!.roundNumber).toBe(1);
    expect(result.rounds[0]!.contributions).toHaveLength(2);
    expect(result.rounds[0]!.contributions[0]!.agentName).toBe("alice");
    expect(result.rounds[0]!.contributions[0]!.output).toBe("Alice round 1");
    expect(result.rounds[0]!.contributions[1]!.agentName).toBe("bob");
    expect(result.rounds[1]!.roundNumber).toBe(2);
    expect(result.synthesis).toBeUndefined();
    // Output should be last round concatenated
    expect(result.output).toContain("Alice round 2");
    expect(result.output).toContain("Bob round 2");
    expect(result.topic).toBe("Tabs vs spaces");
  });

  it("should run a debate with moderator (framing + synthesis)", async () => {
    const { agent: alice } = createParticipant("alice", [
      { content: "Alice argues X", usage: USAGE, finishReason: "stop" },
    ]);
    const { agent: bob } = createParticipant("bob", [
      { content: "Bob argues Y", usage: USAGE, finishReason: "stop" },
    ]);
    const { agent: moderator } = createParticipant("moderator", [
      {
        content: "Let's discuss the topic carefully.",
        usage: USAGE,
        finishReason: "stop",
      },
      {
        content: "In conclusion, both X and Y have merit.",
        usage: USAGE,
        finishReason: "stop",
      },
    ]);

    const debate = createDebate({
      name: "moderated-debate",
      participants: [alice, bob],
      maxRounds: 1,
      moderator,
    });

    const result = await debate.run("Topic A");

    expect(result.status).toBe("completed");
    expect(result.synthesis).toBe(
      "In conclusion, both X and Y have merit.",
    );
    expect(result.output).toBe("In conclusion, both X and Y have merit.");
    expect(result.rounds).toHaveLength(1);
  });

  it("should default maxRounds to 3", async () => {
    const { agent: alice, provider: aliceProvider } = createParticipant(
      "alice",
      Array.from({ length: 3 }, () => ({
        content: "Alice response",
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );

    const debate = createDebate({
      name: "default-rounds",
      participants: [alice],
    });

    const result = await debate.run("Topic");

    expect(result.rounds).toHaveLength(3);
    expect(aliceProvider.chat).toHaveBeenCalledTimes(3);
  });

  it("should respect custom maxRounds", async () => {
    const { agent: alice, provider: aliceProvider } = createParticipant(
      "alice",
      Array.from({ length: 5 }, () => ({
        content: "Alice response",
        usage: USAGE,
        finishReason: "stop" as const,
      })),
    );

    const debate = createDebate({
      name: "custom-rounds",
      participants: [alice],
      maxRounds: 5,
    });

    const result = await debate.run("Topic");

    expect(result.rounds).toHaveLength(5);
    expect(aliceProvider.chat).toHaveBeenCalledTimes(5);
  });

  it("should pass transcript to subsequent participants", async () => {
    const aliceProvider = createMockProvider([
      { content: "Alice says hello", usage: USAGE, finishReason: "stop" },
    ]);
    const alice = new Agent({
      name: "alice",
      systemPrompt: "You are alice.",
      provider: aliceProvider,
      model: { model: "test-model" },
    });

    const bobProvider = createMockProvider([
      { content: "Bob responds", usage: USAGE, finishReason: "stop" },
    ]);
    const bob = new Agent({
      name: "bob",
      systemPrompt: "You are bob.",
      provider: bobProvider,
      model: { model: "test-model" },
    });

    const debate = createDebate({
      name: "transcript-test",
      participants: [alice, bob],
      maxRounds: 1,
    });

    await debate.run("Test topic");

    // Bob's input should contain Alice's output
    const bobCallMessages = (bobProvider.chat as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Message[];
    const userMessage = bobCallMessages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("[alice]: Alice says hello");
  });

  it("should stop early and return failed when an agent fails", async () => {
    const failProvider: ModelProvider = {
      chat: vi.fn(async () => {
        throw new Error("LLM error");
      }),
    };
    const failAgent = new Agent({
      name: "fail-agent",
      systemPrompt: "Fail.",
      provider: failProvider,
      model: { model: "test-model" },
    });

    const { agent: bob } = createParticipant("bob", [
      { content: "Bob response", usage: USAGE, finishReason: "stop" },
    ]);

    const debate = createDebate({
      name: "fail-debate",
      participants: [failAgent, bob],
      maxRounds: 2,
    });

    const result = await debate.run("Topic");

    expect(result.status).toBe("failed");
    // Should have no completed rounds since first participant in round 1 failed
    expect(result.rounds).toHaveLength(0);
  });

  it("should return an asHandler function that sets payload", async () => {
    const { agent: alice } = createParticipant("alice", [
      { content: "Alice response", usage: USAGE, finishReason: "stop" },
    ]);

    const debate = createDebate({
      name: "handler-test",
      participants: [alice],
      maxRounds: 1,
    });

    const handler = debate.asHandler();
    expect(typeof handler).toBe("function");

    const setPayload = vi.fn();
    await handler({
      requestId: "req-123",
      payload: { input: "Handler topic" },
      publish: vi.fn(async () => ""),
      setPayload,
    });

    expect(setPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        debateOutput: "Alice response",
        debateStatus: "completed",
        debateRounds: 1,
        debateSynthesis: undefined,
        debateTokenUsage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
      }),
    );
  });

  it("should work with a single participant", async () => {
    const { agent: alice } = createParticipant("alice", [
      { content: "Solo response 1", usage: USAGE, finishReason: "stop" },
      { content: "Solo response 2", usage: USAGE, finishReason: "stop" },
    ]);

    const debate = createDebate({
      name: "solo-debate",
      participants: [alice],
      maxRounds: 2,
    });

    const result = await debate.run("Solo topic");

    expect(result.status).toBe("completed");
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]!.contributions).toHaveLength(1);
    expect(result.rounds[1]!.contributions).toHaveLength(1);
  });

  it("should accumulate token usage across all participants and rounds", async () => {
    const usage1 = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const usage2 = { promptTokens: 20, completionTokens: 10, totalTokens: 30 };

    const { agent: alice } = createParticipant("alice", [
      { content: "Alice", usage: usage1, finishReason: "stop" },
    ]);
    const { agent: bob } = createParticipant("bob", [
      { content: "Bob", usage: usage2, finishReason: "stop" },
    ]);

    const debate = createDebate({
      name: "usage-test",
      participants: [alice, bob],
      maxRounds: 1,
    });

    const result = await debate.run("Topic");

    expect(result.tokenUsage.promptTokens).toBe(30);
    expect(result.tokenUsage.completionTokens).toBe(15);
    expect(result.tokenUsage.totalTokens).toBe(45);
  });
});
