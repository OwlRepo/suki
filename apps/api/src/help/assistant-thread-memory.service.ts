import { Injectable } from "@nestjs/common";
import { getDb, assistantThreadMemories } from "@suki/database";
import { and, eq } from "drizzle-orm";

type ThreadTurn = { role: "user" | "assistant"; text: string };

@Injectable()
export class AssistantThreadMemoryService {
  async getThreadMemory(organizationId: string, userId: string, threadId: string): Promise<{ summary: string; turns: ThreadTurn[] }> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(assistantThreadMemories)
      .where(
        and(
          eq(assistantThreadMemories.organizationId, organizationId),
          eq(assistantThreadMemories.userId, userId),
          eq(assistantThreadMemories.threadId, threadId),
        ),
      )
      .limit(1);

    if (!row) {
      return { summary: "", turns: [] };
    }

    return {
      summary: row.summary ?? "",
      turns: (row.lastTurns as ThreadTurn[]) ?? [],
    };
  }

  async saveThreadMemory(
    organizationId: string,
    userId: string,
    threadId: string,
    turns: ThreadTurn[],
    summary: string,
  ): Promise<void> {
    const db = getDb();
    const [existing] = await db
      .select({ id: assistantThreadMemories.id })
      .from(assistantThreadMemories)
      .where(
        and(
          eq(assistantThreadMemories.organizationId, organizationId),
          eq(assistantThreadMemories.userId, userId),
          eq(assistantThreadMemories.threadId, threadId),
        ),
      )
      .limit(1);

    const normalizedTurns = turns.slice(-8);

    if (existing?.id) {
      await db
        .update(assistantThreadMemories)
        .set({
          summary,
          lastTurns: normalizedTurns,
          updatedAt: new Date(),
        })
        .where(eq(assistantThreadMemories.id, existing.id));
      return;
    }

    await db.insert(assistantThreadMemories).values({
      organizationId,
      userId,
      threadId,
      summary,
      lastTurns: normalizedTurns,
    });
  }
}
