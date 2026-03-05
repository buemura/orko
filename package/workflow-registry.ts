import { logger } from "./logger.js";

import type { HandlerRegistry } from "./handler-registry.js";
import type { RedisManager } from "./redis.js";
import type { SynkroWorkflow } from "./types.js";

type WorkflowState = {
  workflowName: string;
  currentStep: number;
  status: "running" | "completed" | "failed";
};

export class WorkflowRegistry {
  private workflows = new Map<string, SynkroWorkflow>();
  private eventToWorkflows = new Map<
    string,
    { workflow: SynkroWorkflow; stepIndex: number }[]
  >();

  constructor(
    private redis: RedisManager,
    private handlerRegistry: HandlerRegistry,
  ) {}

  registerWorkflows(workflows: SynkroWorkflow[]): void {
    for (const workflow of workflows) {
      this.workflows.set(workflow.name, workflow);

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i]!;
        const key = step.type;

        if (!this.eventToWorkflows.has(key)) {
          this.eventToWorkflows.set(key, []);
        }
        this.eventToWorkflows.get(key)!.push({ workflow, stepIndex: i });

        const channel = this.stepChannel(workflow.name, step.type);
        this.handlerRegistry.register(channel, step.handler);
      }

      this.subscribeToWorkflowEvents(workflow);
      logger.debug(
        `[WorkflowRegistry] - Workflow "${workflow.name}" registered with ${workflow.steps.length} steps`,
      );
    }
  }

  hasWorkflow(name: string): boolean {
    return this.workflows.has(name);
  }

  async startWorkflow(
    workflowName: string,
    requestId: string,
    payload: unknown,
  ): Promise<void> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(
        `[WorkflowRegistry] - Workflow "${workflowName}" not found`,
      );
    }

    const state: WorkflowState = {
      workflowName,
      currentStep: 0,
      status: "running",
    };
    await this.saveState(requestId, state);

    const firstStep = workflow.steps[0]!;
    const channel = this.stepChannel(workflowName, firstStep.type);
    logger.debug(
      `[WorkflowRegistry] - Starting workflow "${workflowName}" (requestId: ${requestId}), publishing "${firstStep.type}"`,
    );

    this.redis.publishMessage(
      channel,
      JSON.stringify({ requestId, payload }),
    );
  }

  private subscribeToWorkflowEvents(workflow: SynkroWorkflow): void {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]!;
      const channel = this.stepChannel(workflow.name, step.type);
      const completionChannel = `event:${channel}:completed`;

      this.redis.subscribeToChannel(completionChannel, (message: string) => {
        this.handleStepCompletion(workflow, i, message);
      });
    }
  }

  private async handleStepCompletion(
    workflow: SynkroWorkflow,
    stepIndex: number,
    message: string,
  ): Promise<void> {
    const { requestId, payload } = JSON.parse(message) as {
      requestId: string;
      payload: unknown;
    };

    const state = await this.getState(requestId);
    if (!state || state.workflowName !== workflow.name) {
      return;
    }

    if (state.currentStep !== stepIndex) {
      logger.warn(
        `[WorkflowRegistry] - Step mismatch for "${workflow.name}" (requestId: ${requestId}): expected step ${state.currentStep}, got ${stepIndex}`,
      );
      return;
    }

    const nextStepIndex = stepIndex + 1;

    if (nextStepIndex >= workflow.steps.length) {
      state.status = "completed";
      state.currentStep = stepIndex;
      await this.saveState(requestId, state);
      logger.debug(
        `[WorkflowRegistry] - Workflow "${workflow.name}" completed (requestId: ${requestId})`,
      );
      return;
    }

    state.currentStep = nextStepIndex;
    await this.saveState(requestId, state);

    const nextStep = workflow.steps[nextStepIndex]!;
    const nextChannel = this.stepChannel(workflow.name, nextStep.type);
    logger.debug(
      `[WorkflowRegistry] - Workflow "${workflow.name}" advancing to step ${nextStepIndex}: "${nextStep.type}" (requestId: ${requestId})`,
    );

    this.redis.publishMessage(
      nextChannel,
      JSON.stringify({ requestId, payload }),
    );
  }

  private stepChannel(workflowName: string, stepType: string): string {
    return `workflow:${workflowName}:${stepType}`;
  }

  private stateKey(requestId: string): string {
    return `workflow:state:${requestId}`;
  }

  private async saveState(
    requestId: string,
    state: WorkflowState,
  ): Promise<void> {
    await this.redis.setCache(
      this.stateKey(requestId),
      JSON.stringify(state),
      86400,
    );
  }

  private async getState(requestId: string): Promise<WorkflowState | null> {
    const raw = await this.redis.getCache(this.stateKey(requestId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkflowState;
  }
}
