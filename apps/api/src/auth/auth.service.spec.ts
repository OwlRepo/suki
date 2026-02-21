import { describe, it, expect } from "vitest";
import { AuthService } from "./auth.service";
import { getDb } from "@suki/database";
import { users, organizations } from "@suki/database";
import { eq } from "drizzle-orm";

describe("AuthService", () => {
  const service = new AuthService();

  describe("syncUser", () => {
    it("concurrent syncUser calls for same clerkId return one user and no 500", async () => {
      const clerkId = `sync-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const email = "concurrent-test@example.com";

      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.syncUser(clerkId, email))
      );

      expect(results).toHaveLength(5);
      const userId = results[0]?.user.id;
      expect(userId).toBeDefined();
      for (const r of results) {
        expect(r.user.id).toBe(userId);
        expect(r.organization.id).toBeDefined();
      }

      const db = getDb();
      const matching = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId));
      expect(matching).toHaveLength(1);

      const orgId = results[0].organization.id;
      await db.delete(users).where(eq(users.clerkId, clerkId));
      await db.delete(organizations).where(eq(organizations.id, orgId));
    });
  });
});
