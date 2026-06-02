import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { organizations } from "@tyvera/database";
import { eq } from "drizzle-orm";
import type { OrgBillingStatus, PlanType } from "@tyvera/types";

export interface OrgBillingState {
  billingStatus: OrgBillingStatus;
  currentPlan: PlanType;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
  isTrialExpired: boolean;
  isReadOnly: boolean;
  canSendAutomations: boolean;
  nextBillingDueAt: Date | null;
  manualBillingNotes: string | null;
}

const READ_ONLY_STATUSES: OrgBillingStatus[] = [
  "trial_expired",
  "past_due_manual",
  "cancelled_manual",
  "suspended",
];

const CAN_SEND_STATUSES: OrgBillingStatus[] = ["trial_active", "active_manual"];

@Injectable()
export class OrgBillingStateService {
  async getOrgBillingState(orgId: string): Promise<OrgBillingState | null> {
    const db = getDb();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!org) return null;
    return this.deriveState(org);
  }

  deriveState(org: {
    trialStartsAt: Date | null;
    trialEndsAt: Date | null;
    billingStatus: string | null;
    currentPlan: string | null;
    accessEndsAt: Date | null;
    nextBillingDueAt: Date | null;
    manualBillingNotes: string | null;
  }): OrgBillingState {
    const now = new Date();
    let effectiveStatus = (org.billingStatus ?? "trial_active") as OrgBillingStatus;

    if (
      effectiveStatus === "trial_active" &&
      org.trialEndsAt &&
      now > org.trialEndsAt
    ) {
      effectiveStatus = "trial_expired";
    }

    if (org.accessEndsAt && now > org.accessEndsAt) {
      effectiveStatus = "suspended";
    }

    const plan = (org.currentPlan ?? "starter") as PlanType;
    const isReadOnly = READ_ONLY_STATUSES.includes(effectiveStatus);
    const canSendAutomations = CAN_SEND_STATUSES.includes(effectiveStatus);
    const isTrialExpired = effectiveStatus === "trial_expired";

    let daysRemaining: number | null = null;
    if (effectiveStatus === "trial_active" && org.trialEndsAt) {
      const diff = org.trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    }

    return {
      billingStatus: effectiveStatus,
      currentPlan: plan,
      trialStartsAt: org.trialStartsAt ?? null,
      trialEndsAt: org.trialEndsAt ?? null,
      daysRemaining,
      isTrialExpired,
      isReadOnly,
      canSendAutomations,
      nextBillingDueAt: org.nextBillingDueAt ?? null,
      manualBillingNotes: org.manualBillingNotes ?? null,
    };
  }

  canWrite(state: OrgBillingState): boolean {
    return !state.isReadOnly;
  }

  canSend(state: OrgBillingState): boolean {
    return state.canSendAutomations;
  }
}
