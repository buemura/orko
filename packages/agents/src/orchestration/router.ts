import type { HandlerCtx, HandlerFunction } from "@synkro/core";
import type { ModelProvider } from "../llm/provider.js";
import type { ModelOptions } from "../llm/types.js";

export type Route = {
  name: string;
  description: string;
  handler?: HandlerFunction;
};

export type RouterConfig = {
  name: string;
  provider: ModelProvider;
  model: ModelOptions;
  routes: Route[];
  systemPrompt?: string;
  fallback?: string;
};

export function createRouter(config: RouterConfig): {
  asHandler(): HandlerFunction;
  routes: Route[];
} {
  const routeMap = new Map(config.routes.map((r) => [r.name, r]));

  function buildSystemPrompt(): string {
    const routeList = config.routes
      .map((r) => `- "${r.name}": ${r.description}`)
      .join("\n");

    const base = config.systemPrompt
      ? `${config.systemPrompt}\n\n`
      : "You are a routing agent.\n\n";

    return `${base}Select the most appropriate route for the given input.\n\nAvailable routes:\n${routeList}\n\nRespond ONLY with valid JSON: {"route": "<route_name>"}`;
  }

  async function selectRoute(input: string): Promise<string> {
    const systemPrompt = buildSystemPrompt();

    const response = await config.provider.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
      { ...config.model, temperature: 0 },
    );

    let selected: string | undefined;
    try {
      const parsed = JSON.parse(response.content) as { route?: unknown };
      if (typeof parsed.route === "string") {
        selected = parsed.route;
      }
    } catch {
      // JSON parse failed — fall through to fallback
    }

    if (selected && routeMap.has(selected)) {
      return selected;
    }

    if (config.fallback && routeMap.has(config.fallback)) {
      return config.fallback;
    }

    throw new Error(
      `[Router:${config.name}] - Could not determine route and no fallback configured. LLM response: ${response.content}`,
    );
  }

  return {
    routes: config.routes,

    asHandler(): HandlerFunction {
      return async (ctx: HandlerCtx) => {
        const payload = ctx.payload as Record<string, unknown> | undefined;
        const input = typeof payload?.input === "string"
          ? payload.input
          : JSON.stringify(payload);

        const selectedRoute = await selectRoute(input);
        await ctx.publish(selectedRoute, ctx.payload);
      };
    },
  };
}
