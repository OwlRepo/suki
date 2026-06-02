import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { onboardingProgress } from "@tyvera/database";
import { eq, and, isNull } from "drizzle-orm";

@Injectable()
export class OnboardingService {
  async getProgress(organizationId: string, userId?: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(onboardingProgress)
      .where(
        userId
          ? and(
              eq(onboardingProgress.organizationId, organizationId),
              eq(onboardingProgress.userId, userId),
            )
          : and(
              eq(onboardingProgress.organizationId, organizationId),
              isNull(onboardingProgress.userId),
            ),
      )
      .limit(1);
    if (!row) {
      return {
        currentStep: 0,
        completedSteps: [] as string[],
        timeToFirstValueAt: null as string | null,
      };
    }
    return {
      currentStep: row.currentStep,
      completedSteps: (row.completedSteps as string[]) ?? [],
      timeToFirstValueAt: row.timeToFirstValueAt?.toISOString() ?? null,
    };
  }

  async updateProgress(
    organizationId: string,
    body: { currentStep?: number; completedSteps?: string[]; timeToFirstValueAt?: string | null },
    userId?: string,
  ) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(onboardingProgress)
      .where(
        userId
          ? and(
              eq(onboardingProgress.organizationId, organizationId),
              eq(onboardingProgress.userId, userId),
            )
          : and(
              eq(onboardingProgress.organizationId, organizationId),
              isNull(onboardingProgress.userId),
            ),
      )
      .limit(1);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.currentStep != null) updates.currentStep = body.currentStep;
    if (body.completedSteps != null) updates.completedSteps = body.completedSteps;
    if (body.timeToFirstValueAt !== undefined)
      updates.timeToFirstValueAt = body.timeToFirstValueAt ? new Date(body.timeToFirstValueAt) : null;

    if (existing) {
      await db
        .update(onboardingProgress)
        .set(updates as Record<string, Date | number | string[] | null>)
        .where(eq(onboardingProgress.id, existing.id));
    } else {
      await db.insert(onboardingProgress).values({
        organizationId,
        userId: userId ?? null,
        currentStep: (updates.currentStep as number) ?? 0,
        completedSteps: (updates.completedSteps as string[]) ?? [],
        timeToFirstValueAt:
          typeof updates.timeToFirstValueAt === "string"
            ? new Date(updates.timeToFirstValueAt)
            : (updates.timeToFirstValueAt as Date | null) ?? null,
      });
    }
    return this.getProgress(organizationId, userId);
  }
}
