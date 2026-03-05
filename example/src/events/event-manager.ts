import { Synkro, SynkroEvent, SynkroWorkflow } from "@synkro/core";

import { EventTypes, WorkflowTypes } from "./event-types";
import { paymentCompletedHandler } from "./handlers/payment-completed";
import { paymentRequestedHandler } from "./handlers/payment-requested";
import { stockUpdateHandler } from "./handlers/stock-update";

let synkro: Synkro | null = null;

const events: SynkroEvent[] = [
  {
    type: EventTypes.OrderCreated,
    handler: async ({ requestId, payload }) => {
      console.log(
        `[Event Handler] - Handling OrderCreated for request ${requestId}`,
      );
      // Simulate some processing logic
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    retry: { maxRetries: 3 },
  },
  {
    type: EventTypes.StockUpdate,
    handler: async ({ requestId, payload }) => {
      console.log(
        `[Event Handler] - Handling StockUpdate for request ${requestId}`,
      );

      throw new Error("Simulated failure in StockUpdate handler");
      // Simulate some processing logic
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    retry: { maxRetries: 2 },
  },
];

const workflows: SynkroWorkflow[] = [
  {
    name: WorkflowTypes.ProcessOrder,
    steps: [
      {
        type: EventTypes.StockUpdate,
        handler: stockUpdateHandler,
        retry: { maxRetries: 3 },
      },
      {
        type: EventTypes.PaymentRequested,
        handler: paymentRequestedHandler,
      },
      {
        type: EventTypes.PaymentCompleted,
        handler: paymentCompletedHandler,
      },
    ],
  },
];

export async function eventManagerSetup(): Promise<Synkro> {
  if (synkro) return synkro;

  synkro = await Synkro.start({
    redisUrl: process.env.REDIS_URL! || "redis://localhost:6379",
    debug: true,
    events,
    workflows,
  });

  return synkro;
}
