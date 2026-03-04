import { HandlerCtx } from "@mastermind/core";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { orders, payments } from "../../db/schema";

export async function paymentRequestedHandler(ctx: HandlerCtx) {
  const { orderId, amount } = ctx.payload as {
    orderId: string;
    amount: number;
  };

  console.log(`Payment requested for order: ${orderId}`);

  await db.insert(payments).values({
    orderId,
    amount: String(amount),
    status: "pending",
  });

  await db
    .update(orders)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}
