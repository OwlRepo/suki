import { Injectable } from "@nestjs/common";
import { getDb, otpProviderSettings } from "@tyvera/database";
import { eq } from "drizzle-orm";
import type { OtpProviderName } from "./otp-provider";

@Injectable()
export class OtpProviderSettingsService {
  async getProvider(organizationId: string): Promise<OtpProviderName | null> {
    const db = getDb();
    const [row] = await db
      .select({ provider: otpProviderSettings.provider })
      .from(otpProviderSettings)
      .where(eq(otpProviderSettings.organizationId, organizationId))
      .limit(1);
    return row?.provider === "semaphore" || row?.provider === "twilio"
      ? row.provider
      : null;
  }

  async switchToSemaphore(input: {
    organizationId: string;
    reason: string;
  }): Promise<void> {
    const db = getDb();
    const now = new Date();
    const existing = await this.getProvider(input.organizationId);
    if (existing) {
      await db
        .update(otpProviderSettings)
        .set({
          provider: "semaphore",
          switchedAt: now,
          switchReason: input.reason,
          updatedAt: now,
        })
        .where(eq(otpProviderSettings.organizationId, input.organizationId));
      return;
    }

    await db.insert(otpProviderSettings).values({
      organizationId: input.organizationId,
      provider: "semaphore",
      switchedAt: now,
      switchReason: input.reason,
      createdAt: now,
      updatedAt: now,
    });
  }
}
