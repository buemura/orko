import type { RedisManager } from "./redis.js";
import type { HandlerCtx, HandlerFunction } from "./types.js";

export class HandlerRegistry {
  private handlers = new Map<string, HandlerFunction>();

  constructor(private redis: RedisManager) {}

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
      return;
    }

    const event = JSON.parse(message) as HandlerCtx;

    await handler({ requestId: event.requestId, payload: event.payload });

    this.redis.publishMessage(
      `event:${eventType}:completed`,
      JSON.stringify({ requestId: event.requestId, payload: event.payload }),
    );
  }
}
