import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL!;

export const db = drizzle(DATABASE_URL, { schema });
