import { HandlerCtx } from "@mastermind/core";
import { eq, sql } from "drizzle-orm";

import { db } from "../../db";
import { products } from "../../db/schema";

export async function stockUpdateHandler(ctx: HandlerCtx) {
  const { productId, quantity } = ctx.payload as {
    productId: string;
    quantity: number;
  };

  console.log(`Stock update for product: ${productId}, quantity: ${quantity}`);

  await db
    .update(products)
    .set({
      stock: sql`${products.stock} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}
