/**
 * Onboarding success metrics (business-friendly terms):
 * 1. Most new users complete setup and add their first customer on Day 1
 * 2. Users record visits on at least 4 of their first 7 days
 * 3. Users return to the Dashboard daily during the first week
 * 4. Users successfully create at least one appointment and one promo in the first week
 * 5. Fewer support requests mention fear of mistakes or confusion about where to start
 *
 * Events below map to these indicators for measurement.
 */

export type OnboardingEventType =
  | "setup_completed"
  | "first_customer_added"
  | "visit_recorded"
  | "dashboard_viewed"
  | "appointment_created"
  | "promo_created"
  | "loyalty_enabled"
  | "import_completed"
  | "checklist_item_done"
  | "practice_mode_exited"
  | "onboarding_completed";

export interface OnboardingEvent {
  type: OnboardingEventType;
  organizationId: string | null;
  day?: number;
  timestamp: string;
}

const STORAGE_KEY = "suki-onboarding-events";

export function recordOnboardingEvent(
  type: OnboardingEventType,
  organizationId: string | null,
  meta?: { day?: number }
) {
  const event: OnboardingEvent = {
    type,
    organizationId,
    ...meta,
    timestamp: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const events: OnboardingEvent[] = raw ? JSON.parse(raw) : [];
      events.push(event);
      if (events.length > 200) events.splice(0, events.length - 200);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // ignore
    }
  }
}

export function getOnboardingEvents(): OnboardingEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
