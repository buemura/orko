export type SynkroEvent = {
  type: string;
  handler: HandlerFunction;
};

export type SynkroWorkflowStep = {
  type: string;
  handler: HandlerFunction;
};

export type SynkroWorkflow = {
  name: string;
  steps: SynkroWorkflowStep[];
};

export type SynkroOptions = {
  redisUrl: string;
  debug?: boolean;
  events?: SynkroEvent[];
  workflows?: SynkroWorkflow[];
};

export type HandlerCtx = {
  requestId: string;
  payload: unknown;
};

export type HandlerFunction = (ctx: HandlerCtx) => void | Promise<void>;
