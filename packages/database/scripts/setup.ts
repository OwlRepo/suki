import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dir, "../../../.env"), override: false });

const fullConnectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/suki";

const url = new URL(fullConnectionString.replace("postgresql://", "http://"));
const databaseName = url.pathname.slice(1) || "suki";
const adminConnectionString = fullConnectionString.replace(
  `/${databaseName}`,
  "/postgres"
);

async function main() {
  let targetDbExists = false;
  try {
    const testSql = postgres(fullConnectionString, { max: 1 });
    await testSql`SELECT 1`;
    await testSql.end();
    targetDbExists = true;
    console.log(`Database '${databaseName}' already exists and is accessible.`);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === "3D000" || err?.message?.includes("does not exist")) {
      console.log(`Database '${databaseName}' does not exist. Attempting to create...`);
      targetDbExists = false;
    } else {
      console.error(`Failed to connect to database '${databaseName}':`, err?.message);
      process.exit(1);
    }
  }

  if (!targetDbExists) {
    try {
      const adminSql = postgres(adminConnectionString, { max: 1 });
      const result = await adminSql`
        SELECT 1 FROM pg_database WHERE datname = ${databaseName}
      `;
      if (result.length === 0) {
        console.log(`Creating database '${databaseName}'...`);
        const escapedDbName = databaseName.replace(/"/g, '""');
        await adminSql.unsafe(`CREATE DATABASE "${escapedDbName}"`);
        console.log(`Database '${databaseName}' created successfully!`);
      }
      await adminSql.end();
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === "28P01") {
        console.warn("Authentication failed. Continuing to migrations...");
      } else {
        console.warn("Failed to create database. Continuing to migrations...");
      }
    }
  }

  try {
    console.log("\nRunning migrations...");
    const migrationsFolder = resolve(import.meta.dir, "../drizzle");
    const sql = postgres(fullConnectionString, { max: 1 });
    const db = drizzle(sql);
    await migrate(db, {
      migrationsFolder,
    });
    console.log("Migrations complete!");
    await sql.end();
    process.exit(0);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === "3D000") {
      console.error("Database does not exist. Create it manually and run db:migrate.");
    } else {
      console.error("Migration failed:", err?.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
