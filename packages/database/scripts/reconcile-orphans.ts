/**
 * Reconcile orphan org/subscription records from failed sync attempts.
 * Orphan = organization with no corresponding user row.
 *
 * Usage:
 *   bun run scripts/reconcile-orphans.ts       # report only (dry run)
 *   bun run scripts/reconcile-orphans.ts --fix # delete orphan records
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "path";
import { inArray } from "drizzle-orm";
import * as schema from "../src/schema";
import { organizations } from "../src/schema";

config({ path: resolve(import.meta.dir, "../../../.env"), override: false });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/tyvera";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function main() {
  const fix = process.argv.includes("--fix");

  const rows = (await client`
    SELECT o.id, o.name, o.created_at
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id
    WHERE u.id IS NULL
  `) as { id: string; name: string; created_at: Date }[];
  const count = rows.length;

  if (count === 0) {
    console.log("No orphan organizations found.");
    await client.end();
    process.exit(0);
  }

  console.log(`Found ${count} orphan organization(s) (no user linked):`);
  for (const row of rows) {
    console.log(`  - ${row.id} "${row.name}" (created ${row.created_at})`);
  }

  if (!fix) {
    console.log("\nDry run. Pass --fix to delete these records.");
    await client.end();
    process.exit(0);
  }

  await db.delete(organizations).where(inArray(organizations.id, rows.map((r) => r.id)));
  console.log(`\nDeleted ${count} orphan organization(s). Subscriptions cascade.`);
  await client.end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Reconciliation failed:", error);
  await client.end();
  process.exit(1);
});
