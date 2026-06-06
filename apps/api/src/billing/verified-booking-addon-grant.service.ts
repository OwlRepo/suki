import { Injectable } from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import type { AddonFulfillmentSource, BillingAddonSku } from "@tyvera/types";
import { and, eq } from "drizzle-orm";

type BillingTx = {
  select: ReturnType<typeof getDb>["select"];
  insert: ReturnType<typeof getDb>["insert"];
  update: ReturnType<typeof getDb>["update"];
};

type VerifiedBookingLedger = {
  organizationId: string;
  month: string;
  includedGranted: number;
  addonGranted: number;
  used: number;
  sourcePlan: "free" | "starter" | "growth" | "pro";
};

export interface VerifiedBookingAddonGrantInput {
  organizationId: string;
  units: number;
  pricePhp: number;
  sku: BillingAddonSku;
  source: AddonFulfillmentSource;
  sourceReference: string;
  purchasedByUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VerifiedBookingAddonGrantResult {
  alreadyGranted: boolean;
  ledgerBefore: VerifiedBookingLedger;
  ledgerAfter: VerifiedBookingLedger;
}

@Injectable()
export class VerifiedBookingAddonGrantService {
  async grant(
    input: VerifiedBookingAddonGrantInput,
    tx: BillingTx = getDb(),
  ): Promise<VerifiedBookingAddonGrantResult> {
    const [existingGrant] = await tx
      .select()
      .from(verifiedOnlineBookingAddons)
      .where(
        and(
          eq(verifiedOnlineBookingAddons.source, input.source),
          eq(verifiedOnlineBookingAddons.sourceReference, input.sourceReference),
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
      addonGranted: ledger.addonGranted + input.units,
    };

    await tx
      .update(verifiedOnlineBookingCredits)
      .set({
        addonGranted: ledgerAfter.addonGranted,
        used: ledger.used,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, input.organizationId),
          eq(verifiedOnlineBookingCredits.month, ledger.month),
        ),
      );

    await tx.insert(verifiedOnlineBookingAddons).values({
      organizationId: input.organizationId,
      units: input.units,
      pricePhp: input.pricePhp,
      sku: input.sku,
      providerOrderId:
        input.source === "lemonsqueezy" ? input.sourceReference : null,
      source: input.source,
      sourceReference: input.sourceReference,
      purchasedByUserId: input.purchasedByUserId ?? null,
    });

    await tx.insert(creditReconciliationEvents).values({
      organizationId: input.organizationId,
      creditType: "verified_online_booking",
      month: ledger.month,
      eventType: input.source,
      includedBefore: ledger.includedGranted,
      includedAfter: ledger.includedGranted,
      addonBefore: ledger.addonGranted,
      addonAfter: ledgerAfter.addonGranted,
      usedBefore: ledger.used,
      usedAfter: ledger.used,
      providerEventId:
        input.source === "lemonsqueezy" ? input.sourceReference : null,
      metadata: {
        ...input.metadata,
        source: input.source,
        sourceReference: input.sourceReference,
        sku: input.sku,
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
  ): Promise<VerifiedBookingLedger> {
    const month = this.currentMonthKey();
    const [existingLedger] = await tx
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, organizationId),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      )
      .limit(1);

    if (existingLedger) {
      return {
        organizationId: existingLedger.organizationId,
        month: existingLedger.month,
        includedGranted: existingLedger.includedGranted,
        addonGranted: existingLedger.addonGranted,
        used: existingLedger.used,
        sourcePlan: existingLedger.sourcePlan,
      };
    }

    const ledger: VerifiedBookingLedger = {
      organizationId,
      month,
      includedGranted: 0,
      addonGranted: 0,
      used: 0,
      sourcePlan: "free",
    };
    await tx.insert(verifiedOnlineBookingCredits).values(ledger);
    return ledger;
  }

  private currentMonthKey(date = new Date()): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
