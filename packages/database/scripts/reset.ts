import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "path";
import {
  aiCredits,
  appointments,
  promos,
  customers,
  subscriptions,
  users,
  businesses,
  organizations,
} from "../src/schema";

config({ path: resolve(import.meta.dir, "../../../.env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/suki";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  console.log("Resetting database...");

  await db.delete(aiCredits);
  await db.delete(appointments);
  await db.delete(promos);
  await db.delete(customers);
  await db.delete(subscriptions);
  await db.delete(users);
  await db.delete(businesses);
  await db.delete(organizations);

  console.log("Database reset complete!");
  await client.end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Reset failed:", error);
  await client.end();
  process.exit(1);
});
