import * as path from "node:path";

import type { RedisManager } from "./redis.js";
import type { Config, HandlerCtx, HandlerFunction } from "./types.js";

export class HandlerRegistry {
  private handlers = new Map<string, HandlerFunction>();

  constructor(private redis: RedisManager) {}

  async registerFromConfig(config: Config): Promise<void> {
    for (const event of config.events ?? []) {
      const resolvedPath = path.resolve(process.cwd(), event.handler);

      const module = await import(resolvedPath);
      const handlerFn: unknown = module.handler;

      if (typeof handlerFn !== "function") {
        throw new Error(
          `[HandlerRegistry] - Handler for "${event.type}" in ${resolvedPath} does not export a function named 'handler'`,
        );
      }

      this.register(event.type, handlerFn as HandlerFunction);
      console.log(
        `[HandlerRegistry] - Handler for "${event.type}" loaded from ${resolvedPath}`,
      );
    }
  }

  register(eventType: string, handlerFn: HandlerFunction): void {
    this.handlers.set(eventType, handlerFn);

    this.redis.subscribeToChannel(eventType, (message: string) => {
      this.handleMessage(eventType, message);
    });
  }

  private async handleMessage(
    eventType: string,
    message: string,
  ): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      console.warn(
        `[HandlerRegistry] - No handler found for event "${eventType}"`,
      );
      return;
    }

    const event = JSON.parse(message) as HandlerCtx;
    console.log(
      `[HandlerRegistry] - Received message for event "${eventType}": ${message}`,
    );

    await handler({ requestId: event.requestId, payload: event.payload });

    this.redis.publishMessage(
      `event:${eventType}:completed`,
      JSON.stringify({ requestId: event.requestId, payload: event.payload }),
    );
  }
}
