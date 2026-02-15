import { Controller, Get } from "@nestjs/common";
import { getDb } from "@suki/database";
import { sql } from "drizzle-orm";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("db")
  async dbHealth() {
    try {
      const db = getDb();
      await (db as { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }).execute(sql`SELECT 1`);
      return { status: "ok", database: "connected" };
    } catch {
      return { status: "error", database: "disconnected" };
    }
  }
}
