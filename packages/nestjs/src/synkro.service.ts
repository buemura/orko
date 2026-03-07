import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Synkro } from "@synkro/core";
import type {
  EventMetrics,
  HandlerFunction,
  RetryConfig,
  SynkroIntrospection,
  SynkroOptions,
} from "@synkro/core";

import { SYNKRO_MODULE_OPTIONS } from "./synkro.constants.js";
import { SynkroExplorer } from "./synkro.explorer.js";
import type { SynkroModuleOptions } from "./synkro.interfaces.js";

@Injectable()
export class SynkroService implements OnModuleInit, OnModuleDestroy {
  private synkro!: Synkro;

  constructor(
    @Inject(SYNKRO_MODULE_OPTIONS)
    private readonly options: SynkroModuleOptions,
    private readonly explorer: SynkroExplorer,
  ) {}

  async onModuleInit(): Promise<void> {
    const workflows = (this.options.workflows ?? []).map((w) => ({
      ...w,
      steps: w.steps.map((s) => ({ ...s })),
    }));

    // Patch decorated handler functions into workflow step definitions
    const stepHandlers = this.explorer.exploreWorkflowStepHandlers();
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        const discovered = stepHandlers.find(
          (h) => h.workflowName === workflow.name && h.stepType === step.type,
        );
        if (discovered) {
          step.handler = discovered.handler;
        }
      }

      // Fail fast if any step is missing a handler (TD-03)
      for (const step of workflow.steps) {
        if (!step.handler) {
          throw new Error(
            `[SynkroModule] - Workflow "${workflow.name}" step "${step.type}" has no handler. ` +
              `Provide an inline handler or use the @OnWorkflowStep decorator on a registered provider.`,
          );
        }
      }
    }

    const synkroOptions: SynkroOptions = {
      transport: this.options.transport,
      connectionUrl: this.options.connectionUrl,
      debug: this.options.debug,
      workflows,
      retention: this.options.retention,
    };

    this.synkro = await Synkro.start(synkroOptions);

    // Register discovered event handlers
    const eventHandlers = this.explorer.exploreEventHandlers();
    for (const { eventType, handler, retry } of eventHandlers) {
      this.synkro.on(eventType, handler, retry);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.synkro) {
      await this.synkro.stop();
    }
  }

  async publish(
    event: string,
    payload?: unknown,
    requestId?: string,
  ): Promise<string> {
    this.ensureInitialized();
    return this.synkro.publish(event, payload, requestId);
  }

  on(eventType: string, handler: HandlerFunction, retry?: RetryConfig): void {
    this.ensureInitialized();
    this.synkro.on(eventType, handler, retry);
  }

  introspect(): SynkroIntrospection {
    this.ensureInitialized();
    return this.synkro.introspect();
  }

  async getEventMetrics(eventType: string): Promise<EventMetrics> {
    this.ensureInitialized();
    return this.synkro.getEventMetrics(eventType);
  }

  getInstance(): Synkro {
    this.ensureInitialized();
    return this.synkro;
  }

  private ensureInitialized(): void {
    if (!this.synkro) {
      throw new Error(
        "[SynkroService] - Service is not initialized. Ensure the module has completed startup before calling this method.",
      );
    }
  }
}
