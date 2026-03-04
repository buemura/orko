import { getCache, publishMessage, setCache, subscribeToChannel } from "./redis";
import type { Config, ConfigWorkflow, ConfigWorkflowSteps } from "./types";

type WorkflowState = {
  workflowName: string;
  currentStep: number;
  status: "running" | "completed" | "failed";
};

export class WorkflowRegistry {
  private workflows = new Map<string, ConfigWorkflow>();
  private eventToWorkflows = new Map<string, { workflow: ConfigWorkflow; stepIndex: number }[]>();

  async registerFromConfig(config: Config): Promise<void> {
    for (const workflow of config.workflows ?? []) {
      this.workflows.set(workflow.name, workflow);

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i]!;
        const key = step.type;

        if (!this.eventToWorkflows.has(key)) {
          this.eventToWorkflows.set(key, []);
        }
        this.eventToWorkflows.get(key)!.push({ workflow, stepIndex: i });
      }

      this.subscribeToWorkflowEvents(workflow);
      console.log(`[WorkflowRegistry] - Workflow "${workflow.name}" registered with ${workflow.steps.length} steps`);
    }
  }

  hasWorkflow(name: string): boolean {
    return this.workflows.has(name);
  }

  async startWorkflow(workflowName: string, requestId: string, payload: unknown): Promise<void> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`[WorkflowRegistry] - Workflow "${workflowName}" not found`);
    }

    const state: WorkflowState = {
      workflowName,
      currentStep: 0,
      status: "running",
    };
    await this.saveState(requestId, state);

    const firstStep = workflow.steps[0]!;
    console.log(`[WorkflowRegistry] - Starting workflow "${workflowName}" (requestId: ${requestId}), publishing "${firstStep.type}"`);

    publishMessage(firstStep.type, JSON.stringify({ requestId, payload }));
  }

  private subscribeToWorkflowEvents(workflow: ConfigWorkflow): void {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]!;
      const completionChannel = this.completionChannel(step);

      subscribeToChannel(completionChannel, (message: string) => {
        this.handleStepCompletion(workflow, i, message);
      });
    }
  }

  private async handleStepCompletion(
    workflow: ConfigWorkflow,
    stepIndex: number,
    message: string,
  ): Promise<void> {
    const { requestId, payload } = JSON.parse(message) as { requestId: string; payload: unknown };

    const state = await this.getState(requestId);
    if (!state || state.workflowName !== workflow.name) {
      return;
    }

    if (state.currentStep !== stepIndex) {
      console.warn(
        `[WorkflowRegistry] - Step mismatch for "${workflow.name}" (requestId: ${requestId}): expected step ${state.currentStep}, got ${stepIndex}`,
      );
      return;
    }

    const nextStepIndex = stepIndex + 1;

    if (nextStepIndex >= workflow.steps.length) {
      state.status = "completed";
      state.currentStep = stepIndex;
      await this.saveState(requestId, state);
      console.log(`[WorkflowRegistry] - Workflow "${workflow.name}" completed (requestId: ${requestId})`);
      return;
    }

    state.currentStep = nextStepIndex;
    await this.saveState(requestId, state);

    const nextStep = workflow.steps[nextStepIndex]!;
    console.log(
      `[WorkflowRegistry] - Workflow "${workflow.name}" advancing to step ${nextStepIndex}: "${nextStep.type}" (requestId: ${requestId})`,
    );

    publishMessage(nextStep.type, JSON.stringify({ requestId, payload }));
  }

  private completionChannel(step: ConfigWorkflowSteps): string {
    return `event:${step.type}:completed`;
  }

  private stateKey(requestId: string): string {
    return `workflow:state:${requestId}`;
  }

  private async saveState(requestId: string, state: WorkflowState): Promise<void> {
    await setCache(this.stateKey(requestId), JSON.stringify(state), 86400);
  }

  private async getState(requestId: string): Promise<WorkflowState | null> {
    const raw = await getCache(this.stateKey(requestId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkflowState;
  }
}
