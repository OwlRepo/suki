import { getDb, smsCredits, verifiedOnlineBookingCredits } from "@suki/database";
import { and, desc, eq, lt } from "drizzle-orm";

type SelectTx = { select: ReturnType<typeof getDb>["select"] };

// Included units are spent before paid add-on units (same rule as add-on refunds).
export function unusedAddonUnits(ledger: {
  included: number;
  addon: number;
  used: number;
}): number {
  return Math.max(0, ledger.addon - Math.max(0, ledger.used - ledger.included));
}

// Paid add-on units never expire: a new month row starts with what the latest earlier row left unused.
export async function smsAddonCarryover(
  tx: SelectTx,
  organizationId: string,
  month: string,
): Promise<number> {
  const [previous] = await tx
    .select({ included: smsCredits.included, addon: smsCredits.addon, used: smsCredits.used })
    .from(smsCredits)
    .where(and(eq(smsCredits.organizationId, organizationId), lt(smsCredits.month, month)))
    .orderBy(desc(smsCredits.month))
    .limit(1);
  return previous ? unusedAddonUnits(previous) : 0;
}

export async function verifiedBookingAddonCarryover(
  tx: SelectTx,
  organizationId: string,
  month: string,
): Promise<number> {
  const [previous] = await tx
    .select({
      included: verifiedOnlineBookingCredits.includedGranted,
      addon: verifiedOnlineBookingCredits.addonGranted,
      used: verifiedOnlineBookingCredits.used,
    })
    .from(verifiedOnlineBookingCredits)
    .where(
      and(
        eq(verifiedOnlineBookingCredits.organizationId, organizationId),
        lt(verifiedOnlineBookingCredits.month, month),
      ),
    )
    .orderBy(desc(verifiedOnlineBookingCredits.month))
    .limit(1);
  return previous ? unusedAddonUnits(previous) : 0;
}
