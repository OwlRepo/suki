import { Injectable } from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  smsAddons,
  smsCredits,
} from "@suki/database";
import type { AddonFulfillmentSource } from "@suki/types";
import { and, eq, sql } from "drizzle-orm";
import { billingMonthKey } from "../common/billing-month";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { smsAddonCarryover } from "./addon-carryover";
import { SMS_INCLUDED_BY_PLAN } from "./plan-catalog";

type BillingTx = {
  select: ReturnType<typeof getDb>["select"];
  insert: ReturnType<typeof getDb>["insert"];
  update: ReturnType<typeof getDb>["update"];
};

type SmsLedger = {
  organizationId: string;
  month: string;
  included: number;
  addon: number;
  used: number;
  pausedReason?: string | null;
};

export interface SmsAddonGrantInput {
  organizationId: string;
  units: number;
  pricePhp: number;
  source: AddonFulfillmentSource;
  sourceReference: string;
  purchasedByUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SmsAddonGrantResult {
  alreadyGranted: boolean;
  ledgerBefore: SmsLedger;
  ledgerAfter: SmsLedger;
}

@Injectable()
export class SmsAddonGrantService {
  constructor(
    private readonly orgBillingState: OrgBillingStateService = new OrgBillingStateService(),
  ) {}

  async grant(
    input: SmsAddonGrantInput,
    tx: BillingTx = getDb(),
  ): Promise<SmsAddonGrantResult> {
    const [existingGrant] = await tx
      .select()
      .from(smsAddons)
      .where(
        and(
          eq(smsAddons.source, input.source),
          eq(smsAddons.sourceReference, input.sourceReference),
        ),
      )
      .limit(1);

    const ledger = await this.getOrCreateLedger(tx, input.organizationId);

    if (existingGrant) {
      return {
        alreadyGranted: true,
        ledgerBefore: ledger,
        ledgerAfter: ledger,
      };
    }

    const [updated] = await tx
      .update(smsCredits)
      .set({
        addon: sql`${smsCredits.addon} + ${input.units}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(smsCredits.organizationId, input.organizationId),
          eq(smsCredits.month, ledger.month),
        ),
      )
      .returning({
        included: smsCredits.included,
        addon: smsCredits.addon,
        used: smsCredits.used,
      });
    const ledgerAfter = { ...ledger, ...updated };

    await tx.insert(smsAddons).values({
      organizationId: input.organizationId,
      packSize: input.units,
      packPricePhp: input.pricePhp,
      source: input.source,
      sourceReference: input.sourceReference,
      purchasedByUserId: input.purchasedByUserId ?? null,
    });

    await tx.insert(creditReconciliationEvents).values({
      organizationId: input.organizationId,
      creditType: "sms_segment",
      month: ledger.month,
      eventType: input.source,
      includedBefore: ledger.included,
      includedAfter: ledgerAfter.included,
      addonBefore: ledger.addon,
      addonAfter: ledgerAfter.addon,
      usedBefore: ledger.used,
      usedAfter: ledgerAfter.used,
      providerEventId:
        input.source === "lemonsqueezy" ? input.sourceReference : null,
      metadata: {
        ...input.metadata,
        source: input.source,
        sourceReference: input.sourceReference,
        units: input.units,
        pricePhp: input.pricePhp,
      },
    });

    return {
      alreadyGranted: false,
      ledgerBefore: ledger,
      ledgerAfter,
    };
  }

  private async getOrCreateLedger(
    tx: BillingTx,
    organizationId: string,
  ): Promise<SmsLedger> {
    const month = billingMonthKey();
    const [existingLedger] = await tx
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, month),
        ),
      )
      .limit(1);

    if (existingLedger) {
      return {
        organizationId: existingLedger.organizationId,
        month: existingLedger.month,
        included: existingLedger.included,
        addon: existingLedger.addon,
        used: existingLedger.used,
        pausedReason: existingLedger.pausedReason,
      };
    }

    // Grace-aware: an org whose payment is failing gets the free included allowance.
    const includedPlan =
      (await this.orgBillingState.getOrgBillingState(organizationId))?.includedCreditsPlan ?? "free";
    const ledger = {
      organizationId,
      month,
      included: SMS_INCLUDED_BY_PLAN[includedPlan],
      addon: await smsAddonCarryover(tx, organizationId, month),
      used: 0,
      pausedReason: "none" as const,
    };
    await tx.insert(smsCredits).values(ledger);
    return ledger;
  }
}
