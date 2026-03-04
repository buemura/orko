import "dotenv/config";

import { db } from ".";
import { products } from "./schema";

const productsSeed = [
  { name: "Wireless Mouse", price: "29.99", stock: 150 },
  { name: "Mechanical Keyboard", price: "89.99", stock: 75 },
  { name: "USB-C Hub", price: "49.99", stock: 200 },
  { name: "Monitor Stand", price: "39.99", stock: 100 },
  { name: "Webcam HD", price: "59.99", stock: 50 },
];

async function seed() {
  console.log("Seeding products...");

  await db.insert(products).values(productsSeed).onConflictDoNothing();

  console.log(`Seeded ${productsSeed.length} products.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
