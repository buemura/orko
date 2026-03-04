import { HandlerCtx } from "@mastermind/core";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { orders, payments } from "../../db/schema";

export async function paymentCompletedHandler(ctx: HandlerCtx) {
  const { orderId } = ctx.payload as { orderId: string };

  console.log(`Payment completed for order: ${orderId}`);

  await db
    .update(payments)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(payments.orderId, orderId));

  await db
    .update(orders)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}
