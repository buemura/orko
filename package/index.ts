import { randomUUID } from "node:crypto";

import { loadConfig } from "./config.js";
import { HandlerRegistry } from "./handler-registry.js";
import { RedisManager } from "./redis.js";
import { WorkflowRegistry } from "./workflow-registry.js";

import type { HandlerFunction, MastermindOptions } from "./types.js";

export class Mastermind {
  private redis: RedisManager;
  private handlerRegistry: HandlerRegistry;
  private workflowRegistry: WorkflowRegistry;

  private constructor(redis: RedisManager) {
    this.redis = redis;
    this.handlerRegistry = new HandlerRegistry(redis);
    this.workflowRegistry = new WorkflowRegistry(redis);
  }

  static async start(options: MastermindOptions): Promise<Mastermind> {
    const redis = new RedisManager(options.redisUrl);
    const instance = new Mastermind(redis);

    if (options.configPath !== undefined) {
      const config = loadConfig(options.configPath);
      await instance.handlerRegistry.registerFromConfig(config);
      await instance.workflowRegistry.registerFromConfig(config);
    }

    return instance;
  }

  on(eventType: string, handler: HandlerFunction): void {
    this.handlerRegistry.register(eventType, handler);
  }

  async publish(event: string, payload?: unknown): Promise<string> {
    const requestId = randomUUID();

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
  Config,
  ConfigHandler,
  ConfigWorkflow,
  ConfigWorkflowSteps,
  HandlerCtx,
  HandlerFunction,
  MastermindOptions,
} from "./types.js";
