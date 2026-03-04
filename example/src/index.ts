import "dotenv/config";

import express, { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db } from "./db";
import { orders, payments } from "./db/schema";
import { eventManagerSetup } from "./events/event-manager";

const app = express();
const PORT = 3000;

app.use(express.json());

app.post("/orders", async (req: Request, res: Response) => {
  const { productId, quantity, amount } = req.body;

  const [order] = await db
    .insert(orders)
    .values({ productId, quantity, amount: String(amount) })
    .returning();

  const mastermind = await eventManagerSetup();
  await mastermind.publish("ProcessOrder", {
    orderId: order!.id,
    productId,
    quantity,
    amount,
  });

  res.status(201).json(order);
});

app.get("/orders/:orderId", async (req: Request, res: Response) => {
  const orderId = req.params.orderId as string;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

app.get("/orders/:orderId/payments", async (req: Request, res: Response) => {
  const orderId = req.params.orderId as string;

  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId));

  res.json(result);
});

async function bootstrap() {
  await eventManagerSetup();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

bootstrap();
