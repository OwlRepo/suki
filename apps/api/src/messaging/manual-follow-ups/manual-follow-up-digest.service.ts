import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  authIdentities,
  getDb,
  manualFollowUpTasks,
  users,
} from "@tyvera/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { EMAIL_PROVIDER } from "../providers/provider.tokens";
import type { IEmailProvider } from "../providers/email.provider";
import { MANUAL_FOLLOW_UP_DIGEST_CRON } from "./manual-follow-up.constants";
import { buildManualFollowUpDigestEmail } from "./manual-follow-up-email.template";
import { ManualFollowUpService } from "./manual-follow-up.service";

@Injectable()
export class ManualFollowUpDigestService {
  constructor(
    private readonly manualFollowUps: ManualFollowUpService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  @Cron(MANUAL_FOLLOW_UP_DIGEST_CRON)
  async runDigest() {
    const db = getDb();
    const orgRows = await db
      .select({
        organizationId: manualFollowUpTasks.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(manualFollowUpTasks)
      .where(
        and(
          eq(manualFollowUpTasks.status, "open"),
          isNull(manualFollowUpTasks.notifiedAt),
        ),
      )
      .groupBy(manualFollowUpTasks.organizationId);

    for (const org of orgRows) {
      await this.sendOrganizationDigest(org.organizationId, Number(org.count ?? 0));
    }
  }

  async sendOrganizationDigest(organizationId: string, count: number) {
    if (count <= 0) return { sent: 0 };
    const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";
    const email = buildManualFollowUpDigestEmail({ count, frontendUrl });
    const db = getDb();
    const owners = await db
      .select({ email: authIdentities.email })
      .from(users)
      .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
      .where(
        and(eq(users.organizationId, organizationId), eq(users.role, "owner")),
      );

    let sent = 0;
    for (const owner of owners) {
      const to = owner.email?.trim();
      if (!to) continue;
      const result = await this.emailProvider.send({
        to,
        subject: email.subject,
        body: email.body,
        clientRef: `manual-follow-up-digest-${organizationId}-${Date.now()}`,
      });
      if (result.ok) sent += 1;
    }

    if (sent > 0) {
      const tasks = await this.manualFollowUps.list({
        organizationId,
        status: "open",
      });
      await this.manualFollowUps.markNotified(
        organizationId,
        tasks.filter((task) => !task.notifiedAt).map((task) => task.id),
      );
    }

    return { sent };
  }
}
