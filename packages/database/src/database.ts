import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function getConnectionString(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;
  const localConnection = "postgresql://postgres:postgres@localhost:5432/tyvera";
  console.warn(
    "[DATABASE] DATABASE_URL not set, using local fallback (localhost:5432)"
  );
  return localConnection;
}

let cachedDb: PostgresJsDatabase<typeof schema> | null = null;
let cachedClient: ReturnType<typeof postgres> | null = null;

function initializeDatabase(): PostgresJsDatabase<typeof schema> {
  if (cachedDb) return cachedDb;

  const connectionString = getConnectionString();
  cachedClient = postgres(connectionString, {
    prepare: false,
    connect_timeout: 10,
    max: 10,
  });
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

export const getDb = () => initializeDatabase();

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get: (_target, prop) => {
    const database = initializeDatabase();
    return (database as unknown as Record<string, unknown>)[prop as string];
  },
});
