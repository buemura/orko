import { randomUUID } from "node:crypto";

import { HandlerRegistry } from "./handler-registry.js";
import { setDebug } from "./logger.js";
import { RedisManager } from "./redis.js";
import { WorkflowRegistry } from "./workflow-registry.js";

import type {
  HandlerFunction,
  RetryConfig,
  SynkroOptions,
} from "./types.js";

export class Synkro {
  private redis: RedisManager;
  private handlerRegistry: HandlerRegistry;
  private workflowRegistry: WorkflowRegistry;

  private constructor(redis: RedisManager) {
    this.redis = redis;
    this.handlerRegistry = new HandlerRegistry(redis);
    this.workflowRegistry = new WorkflowRegistry(redis, this.handlerRegistry);
    this.handlerRegistry.setPublishFn(this.publish.bind(this));
  }

  static async start(options: SynkroOptions): Promise<Synkro> {
    setDebug(options.debug ?? false);
    const redis = new RedisManager(options.redisUrl);
    const instance = new Synkro(redis);

    if (options.events) {
      for (const event of options.events) {
        instance.on(event.type, event.handler, event.retry);
      }
    }

    if (options.workflows) {
      instance.workflowRegistry.registerWorkflows(options.workflows);
    }

    return instance;
  }

  on(eventType: string, handler: HandlerFunction, retry?: RetryConfig): void {
    this.handlerRegistry.register(eventType, handler, retry);
  }

  async publish(
    event: string,
    payload?: unknown,
    requestId?: string,
  ): Promise<string> {
    requestId = requestId ?? randomUUID();

    if (this.workflowRegistry.hasWorkflow(event)) {
      await this.workflowRegistry.startWorkflow(event, requestId, payload);
      return requestId;
    }

    this.redis.publishMessage(
      event,
      JSON.stringify({ requestId, payload }),
    );
    return requestId;
  }

  async stop(): Promise<void> {
    await this.redis.disconnect();
  }
}

export type {
  HandlerCtx,
  HandlerFunction,
  PublishFunction,
  RetryConfig,
  SynkroEvent,
  SynkroOptions,
  SynkroWorkflow,
  SynkroWorkflowStep,
} from "./types.js";
