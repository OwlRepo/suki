import { Injectable } from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@suki/database";
import type { AddonFulfillmentSource, BillingAddonSku } from "@suki/types";
import { and, eq, sql } from "drizzle-orm";
import { billingMonthKey } from "../common/billing-month";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { verifiedBookingAddonCarryover } from "./addon-carryover";
import { getPlanCatalogEntry } from "./plan-catalog";

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
  constructor(
    private readonly orgBillingState: OrgBillingStateService = new OrgBillingStateService(),
  ) {}

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

    const [updated] = await tx
      .update(verifiedOnlineBookingCredits)
      .set({
        addonGranted: sql`${verifiedOnlineBookingCredits.addonGranted} + ${input.units}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, input.organizationId),
          eq(verifiedOnlineBookingCredits.month, ledger.month),
        ),
      )
      .returning({
        includedGranted: verifiedOnlineBookingCredits.includedGranted,
        addonGranted: verifiedOnlineBookingCredits.addonGranted,
        used: verifiedOnlineBookingCredits.used,
      });
    const ledgerAfter = { ...ledger, ...updated };

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
      includedAfter: ledgerAfter.includedGranted,
      addonBefore: ledger.addonGranted,
      addonAfter: ledgerAfter.addonGranted,
      usedBefore: ledger.used,
      usedAfter: ledgerAfter.used,
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
    const month = billingMonthKey();
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

    // Grace-aware: an org whose payment is failing gets the free included allowance.
    const includedPlan =
      (await this.orgBillingState.getOrgBillingState(organizationId))?.includedCreditsPlan ?? "free";
    const sourcePlan = includedPlan;
    const ledger: VerifiedBookingLedger = {
      organizationId,
      month,
      includedGranted: getPlanCatalogEntry(sourcePlan).limits.verifiedOnlineBookingsPerMonth,
      addonGranted: await verifiedBookingAddonCarryover(tx, organizationId, month),
      used: 0,
      sourcePlan,
    };
    await tx.insert(verifiedOnlineBookingCredits).values(ledger);
    return ledger;
  }
}
