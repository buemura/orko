export type MastermindOptions = {
  redisUrl: string;
  configPath?: string;
};

export type ConfigHandler = {
  type: string;
  handler: string;
};

export type ConfigWorkflowSteps = {
  type: string;
  action: string;
};

export type ConfigWorkflow = {
  name: string;
  steps: ConfigWorkflowSteps[];
};

export type Config = {
  events?: ConfigHandler[];
  workflows?: ConfigWorkflow[];
};

export type HandlerCtx = {
  requestId: string;
  payload: unknown;
};

export type HandlerFunction = (ctx: HandlerCtx) => void | Promise<void>;
