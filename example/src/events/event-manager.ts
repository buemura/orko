import { Mastermind } from "@mastermind/core";

import { EventTypes } from "./event-types.enum";
import { paymentCompletedHandler } from "./handlers/payment-completed";
import { paymentRequestedHandler } from "./handlers/payment-requested";
import { stockUpdateHandler } from "./handlers/stock-update";

let mastermind: Mastermind | null = null;

export async function eventManagerSetup(): Promise<Mastermind> {
  if (mastermind) return mastermind;

  mastermind = await Mastermind.start({
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    configPath: "./mastermind.json",
  });

  mastermind.on(EventTypes.PaymentRequested, paymentRequestedHandler);
  mastermind.on(EventTypes.PaymentCompleted, paymentCompletedHandler);
  mastermind.on(EventTypes.StockUpdate, stockUpdateHandler);

  return mastermind;
}
