import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "path";
import { organizations, businesses, users } from "../src/schema";

config({ path: resolve(import.meta.dir, "../../../.env"), override: false });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/suki";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  console.log("Seeding database...");

  const [org] = await db
    .insert(organizations)
    .values({ name: "Sample Organization" })
    .returning();

  await db
    .insert(businesses)
    .values({
      organizationId: org.id,
      name: "Sample Salon",
      businessType: "salon",
    })
    .returning();

  await db.insert(users).values({
    clerkId: "seed-user-1",
    organizationId: org.id,
    role: "owner",
    email: "owner@example.com",
  });

  console.log("Seed complete! Created org, business, and owner user.");
  await client.end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await client.end();
  process.exit(1);
});
