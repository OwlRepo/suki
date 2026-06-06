import { Injectable } from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  smsAddons,
  smsCredits,
} from "@tyvera/database";
import type { AddonFulfillmentSource } from "@tyvera/types";
import { and, eq } from "drizzle-orm";

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

    const ledgerAfter = {
      ...ledger,
      addon: ledger.addon + input.units,
    };

    await tx
      .update(smsCredits)
      .set({
        addon: ledgerAfter.addon,
        used: ledger.used,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(smsCredits.organizationId, input.organizationId),
          eq(smsCredits.month, ledger.month),
        ),
      );

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
      includedAfter: ledger.included,
      addonBefore: ledger.addon,
      addonAfter: ledgerAfter.addon,
      usedBefore: ledger.used,
      usedAfter: ledger.used,
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
    const month = this.currentMonthKey();
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

    const ledger = {
      organizationId,
      month,
      included: 0,
      addon: 0,
      used: 0,
      pausedReason: "none" as const,
    };
    await tx.insert(smsCredits).values(ledger);
    return ledger;
  }

  private currentMonthKey(date = new Date()): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
