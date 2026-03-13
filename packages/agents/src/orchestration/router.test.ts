import { describe, it, expect, vi } from "vitest";
import { createRouter } from "./router.js";
import type { ModelProvider } from "../llm/provider.js";
import type { Message, ModelOptions } from "../llm/types.js";

function createMockProvider(content: string): ModelProvider {
  return {
    chat: vi.fn(async (_messages: Message[], _options: ModelOptions) => ({
      content,
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop" as const,
    })),
  };
}

const ROUTES = [
  { name: "billing", description: "Billing questions: charges, refunds, invoices" },
  { name: "technical", description: "Technical issues: errors, bugs, outages" },
  { name: "general", description: "General questions and feedback" },
];

describe("createRouter", () => {
  it("should return routes array on the returned object", () => {
    const provider = createMockProvider('{"route":"billing"}');
    const router = createRouter({
      name: "test-router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
    });

    expect(router.routes).toBe(ROUTES);
    expect(router.routes).toHaveLength(3);
  });

  it("should publish the route selected by the LLM", async () => {
    const provider = createMockProvider('{"route":"billing"}');
    const publishSpy = vi.fn(async () => "pub-id");

    const router = createRouter({
      name: "ticket-router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
    });

    const handler = router.asHandler();
    await handler({
      requestId: "req-1",
      payload: { input: "I was charged twice" },
      publish: publishSpy,
      setPayload: vi.fn(),
    });

    expect(publishSpy).toHaveBeenCalledWith("billing", { input: "I was charged twice" });
  });

  it("should fall back to configured fallback when LLM returns unknown route", async () => {
    const provider = createMockProvider('{"route":"unknown_route"}');
    const publishSpy = vi.fn(async () => "pub-id");

    const router = createRouter({
      name: "ticket-router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
      fallback: "general",
    });

    const handler = router.asHandler();
    await handler({
      requestId: "req-2",
      payload: { input: "some ambiguous input" },
      publish: publishSpy,
      setPayload: vi.fn(),
    });

    expect(publishSpy).toHaveBeenCalledWith("general", expect.anything());
  });

  it("should fall back when LLM response is not valid JSON", async () => {
    const provider = createMockProvider("I cannot decide");
    const publishSpy = vi.fn(async () => "pub-id");

    const router = createRouter({
      name: "ticket-router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
      fallback: "general",
    });

    const handler = router.asHandler();
    await handler({
      requestId: "req-3",
      payload: { input: "unclear message" },
      publish: publishSpy,
      setPayload: vi.fn(),
    });

    expect(publishSpy).toHaveBeenCalledWith("general", expect.anything());
  });

  it("should throw when no fallback is configured and route cannot be determined", async () => {
    const provider = createMockProvider('{"route":"nonexistent"}');

    const router = createRouter({
      name: "strict-router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
    });

    const handler = router.asHandler();
    await expect(
      handler({
        requestId: "req-4",
        payload: { input: "test" },
        publish: vi.fn(async () => ""),
        setPayload: vi.fn(),
      }),
    ).rejects.toThrow("Could not determine route");
  });

  it("should use temperature 0 when calling the LLM", async () => {
    const chatFn = vi.fn(async () => ({
      content: '{"route":"technical"}',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop" as const,
    }));
    const provider: ModelProvider = { chat: chatFn };

    const router = createRouter({
      name: "router",
      provider,
      model: { model: "test-model", temperature: 0.9 },
      routes: ROUTES,
    });

    const handler = router.asHandler();
    await handler({
      requestId: "req-5",
      payload: { input: "app is crashing" },
      publish: vi.fn(async () => ""),
      setPayload: vi.fn(),
    });

    const calledOptions = chatFn.mock.calls[0]![1] as ModelOptions;
    expect(calledOptions.temperature).toBe(0);
  });

  it("should serialize non-string payload as input", async () => {
    const chatFn = vi.fn(async () => ({
      content: '{"route":"billing"}',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop" as const,
    }));
    const provider: ModelProvider = { chat: chatFn };

    const router = createRouter({
      name: "router",
      provider,
      model: { model: "test-model" },
      routes: ROUTES,
    });

    const handler = router.asHandler();
    await handler({
      requestId: "req-6",
      payload: { amount: 42, type: "charge" },
      publish: vi.fn(async () => ""),
      setPayload: vi.fn(),
    });

    const messages = chatFn.mock.calls[0]![0] as Message[];
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg!.content).toBe('{"amount":42,"type":"charge"}');
  });
});
