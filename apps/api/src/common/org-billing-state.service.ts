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
  variableCostActionsBlocked: boolean;
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
const VARIABLE_COST_BLOCKED_STATUSES: OrgBillingStatus[] = [
  "subscription_past_due",
  "subscription_paused",
  "suspended",
];

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
    subscriptionStatus?: string | null;
    subscriptionEndsAt?: Date | null;
    subscriptionRenewsAt?: Date | null;
    subscriptionCancelled?: boolean | null;
  }): OrgBillingState {
    const now = new Date();
    let effectiveStatus = (org.billingStatus ?? "free_active") as OrgBillingStatus;

    const plan = (org.currentPlan ?? "free") as PlanType;
    const subscriptionStatus = org.subscriptionStatus ?? null;
    const subscriptionEndsAt = org.subscriptionEndsAt ?? null;

    if (subscriptionStatus === "active") {
      effectiveStatus = "subscription_active";
    } else if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
      effectiveStatus = "subscription_past_due";
    } else if (subscriptionStatus === "paused") {
      effectiveStatus = "subscription_paused";
    } else if (subscriptionStatus === "expired") {
      effectiveStatus = "subscription_expired";
    } else if (subscriptionStatus === "cancelled") {
      effectiveStatus =
        subscriptionEndsAt && subscriptionEndsAt.getTime() > now.getTime()
          ? "subscription_cancelled"
          : "subscription_expired";
    }

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

    const isReadOnly = READ_ONLY_STATUSES.includes(effectiveStatus);
    const canSendAutomations =
      CAN_SEND_STATUSES.includes(effectiveStatus) ||
      effectiveStatus === "free_active" ||
      effectiveStatus === "subscription_active" ||
      effectiveStatus === "subscription_cancelled";
    const isTrialExpired = effectiveStatus === "trial_expired";
    const variableCostActionsBlocked = VARIABLE_COST_BLOCKED_STATUSES.includes(
      effectiveStatus,
    );

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
      variableCostActionsBlocked,
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
