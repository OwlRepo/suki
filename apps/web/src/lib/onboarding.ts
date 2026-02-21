/**
 * Onboarding configuration and sample data for Practice Day mode.
 * Designed for middle-aged, non-technical Philippine small business owners.
 */

export const PRACTICE_SAMPLE_LABEL = "Practice Sample";

// Sample customers with common Philippine names
export const SAMPLE_CUSTOMERS = [
  { id: "sample-1", name: "Maria Santos", mobile: "0917-123-4567", visitCount: 3, lastVisitAt: new Date().toISOString(), tags: "frequent", isPracticeSample: true },
  { id: "sample-2", name: "Juan dela Cruz", mobile: "0922-555-1234", visitCount: 1, lastVisitAt: new Date(Date.now() - 86400000).toISOString(), tags: null, isPracticeSample: true },
  { id: "sample-3", name: "Ana Reyes", mobile: "0918-777-8888", visitCount: 5, lastVisitAt: new Date().toISOString(), tags: "vip,frequent", isPracticeSample: true },
  { id: "sample-4", name: "Pedro Garcia", mobile: "0933-111-2222", visitCount: 0, lastVisitAt: null, tags: null, isPracticeSample: true },
  { id: "sample-5", name: "Liza Fernandez", mobile: "0919-444-5555", visitCount: 2, lastVisitAt: new Date(Date.now() - 2 * 86400000).toISOString(), tags: null, isPracticeSample: true },
  { id: "sample-6", name: "Ramon Torres", mobile: "0928-999-0000", visitCount: 7, lastVisitAt: new Date().toISOString(), tags: "vip", isPracticeSample: true },
  { id: "sample-7", name: "Carla Mendoza", mobile: "0916-333-4444", visitCount: 1, lastVisitAt: null, tags: null, isPracticeSample: true },
  { id: "sample-8", name: "Roberto Villanueva", mobile: "0927-666-7777", visitCount: 4, lastVisitAt: new Date(Date.now() - 86400000).toISOString(), tags: "frequent", isPracticeSample: true },
];

// Sample appointments for today and tomorrow
function sampleAppointments() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
  return [
    { id: "sample-a1", customerId: "sample-1", customerName: "Maria Santos", scheduledAt: d(today, 9, 0).toISOString(), status: "scheduled", notes: null, isPracticeSample: true },
    { id: "sample-a2", customerId: "sample-3", customerName: "Ana Reyes", scheduledAt: d(today, 11, 30).toISOString(), status: "scheduled", notes: null, isPracticeSample: true },
    { id: "sample-a3", customerId: "sample-6", customerName: "Ramon Torres", scheduledAt: d(today, 14, 0).toISOString(), status: "scheduled", notes: "Regular cut", isPracticeSample: true },
    { id: "sample-a4", customerId: "sample-2", customerName: "Juan dela Cruz", scheduledAt: d(tomorrow, 10, 0).toISOString(), status: "scheduled", notes: null, isPracticeSample: true },
    { id: "sample-a5", customerId: "sample-5", customerName: "Liza Fernandez", scheduledAt: d(tomorrow, 15, 0).toISOString(), status: "scheduled", notes: null, isPracticeSample: true },
  ];
}

export const SAMPLE_APPOINTMENTS = sampleAppointments();

// Sample promos
export const SAMPLE_PROMOS = [
  { id: "sample-p1", type: "discount", value: "20% off", validityStart: new Date().toISOString(), validityEnd: new Date(Date.now() + 7 * 86400000).toISOString(), status: "draft", messageContent: "Weekday special: 20% off for regulars", isPracticeSample: true },
  { id: "sample-p2", type: "reminder", value: "Birthday offer", validityStart: new Date().toISOString(), validityEnd: new Date(Date.now() + 30 * 86400000).toISOString(), status: "draft", messageContent: "Happy birthday! Free add-on on your next visit.", isPracticeSample: true },
  { id: "sample-p3", type: "discount", value: "10% referral", validityStart: new Date().toISOString(), validityEnd: new Date(Date.now() + 14 * 86400000).toISOString(), status: "draft", messageContent: "Refer a friend, both get 10% off", isPracticeSample: true },
];

// Sample loyalty setup
export const SAMPLE_LOYALTY = {
  threshold: 5,
  reward: "Visit 5 times, get 1 free",
  isPracticeSample: true,
};

// Onboarding steps with guidance copy
export const ONBOARDING_STEPS = {
  businessSetup: 1,
  firstDashboard: 2,
  customersPage: 3,
  recordVisit: 4,
  appointmentsOverview: 5,
  promos: 6,
  loyalty: 7,
  importCustomers: 8,
} as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

export type StepGuidance = {
  message: string;
  expectedAction: string;
  successFeedback: string;
};

export const STEP_GUIDANCE: Record<number, StepGuidance> = {
  1: {
    message: "Let's set up your business in a few short steps. You can edit this anytime.",
    expectedAction: "Enter business name, service type, hours, and contact details",
    successFeedback: "Great. Your business profile is ready.",
  },
  2: {
    message: "This is your daily home screen. Start with the first card only.",
    expectedAction: "Tap the highlighted first card (e.g., Add first customer)",
    successFeedback: "Nice start. You finished your first daily task.",
  },
  3: {
    message: "Add one customer the same way you write in your notebook.",
    expectedAction: "Create one customer record (name + mobile at minimum)",
    successFeedback: "Customer saved. You can update details anytime.",
  },
  4: {
    message: "Now record today's visit so you can track repeat customers.",
    expectedAction: "Add one visit/service entry for the customer",
    successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
  },
  5: {
    message: "Appointments help you see your day at a glance. Let's add one booking.",
    expectedAction: "Create one appointment for today or tomorrow",
    successFeedback: "Appointment added. Your schedule is now active.",
  },
  6: {
    message: "Create one simple offer your regular customers will understand quickly.",
    expectedAction: "Select a promo template and save one promo",
    successFeedback: "Promo ready. You can turn it on or off anytime.",
  },
  7: {
    message: "Loyalty rewards repeat visits. Start with one easy rule.",
    expectedAction: "Enable one loyalty rule (e.g., visit count reward)",
    successFeedback: "Loyalty is active. Returning customers can now earn rewards.",
  },
  8: {
    message: "Already have a customer list? Import in small batches to stay safe.",
    expectedAction: "Upload a small sample file and preview before final import",
    successFeedback: "Import complete. Review added customers before continuing.",
  },
};

/** Business-type-specific guidance for personalized onboarding scenarios */
export const STEP_GUIDANCE_BY_BUSINESS_TYPE: Record<
  string,
  Partial<Record<number, StepGuidance>>
> = {
  salon: {
    3: {
      message: "Add your first customer — for example, someone who came in for a haircut or treatment today.",
      expectedAction: "Create one customer (name + mobile). Try adding a walk-in or regular.",
      successFeedback: "Customer saved. You can add service notes when you record their visit.",
    },
    4: {
      message: "Record today's visit for that customer so we can track repeat visits.",
      expectedAction: "Add one visit entry — e.g. haircut, color, treatment.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty rewards.",
    },
    5: {
      message: "Add one appointment so you can see your day at a glance.",
      expectedAction: "Create one booking for today or tomorrow (e.g. haircut, blow-dry).",
      successFeedback: "Appointment added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a weekday discount for regulars.",
      expectedAction: "Select a promo type and save (e.g. 20% off haircut for new customers).",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. visit 5 times, get 1 free haircut.",
      expectedAction: "Set a visit threshold and reward (e.g. free add-on, discount).",
      successFeedback: "Loyalty is active. Returning customers can now earn rewards.",
    },
  },
  clinic: {
    3: {
      message: "Add your first patient — for example, someone who came for a consultation today.",
      expectedAction: "Create one patient record (name + mobile).",
      successFeedback: "Patient saved. You can add notes when you record their visit.",
    },
    4: {
      message: "Record today's visit for that patient so we can track follow-ups.",
      expectedAction: "Add one visit entry — e.g. consultation, follow-up, procedure.",
      successFeedback: "Visit recorded. This helps with follow-up and reminders.",
    },
    5: {
      message: "Add one appointment so you can see your schedule.",
      expectedAction: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a reminder for check-ups.",
      expectedAction: "Select a promo type and save (e.g. follow-up reminder).",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. visit 4 times, get a discount on next visit.",
      expectedAction: "Set a visit threshold and reward.",
      successFeedback: "Loyalty is active. Returning patients can now earn rewards.",
    },
  },
  restaurant: {
    3: {
      message: "Add your first customer — for example, someone who ordered takeout or dined in today.",
      expectedAction: "Create one customer (name + mobile).",
      successFeedback: "Customer saved. You can track repeat orders.",
    },
    4: {
      message: "Record today's order or visit for that customer.",
      expectedAction: "Add one visit entry — e.g. dine-in, takeout, delivery.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
    },
    5: {
      message: "Add one reservation or order booking.",
      expectedAction: "Create one booking for today or tomorrow.",
      successFeedback: "Booking added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a weekday special or birthday discount.",
      expectedAction: "Select a promo type and save.",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. visit 5 times, get a free drink or dessert.",
      expectedAction: "Set a visit threshold and reward.",
      successFeedback: "Loyalty is active. Returning customers can now earn rewards.",
    },
  },
  spa: {
    3: {
      message: "Add your first guest — for example, someone who came for a massage or facial today.",
      expectedAction: "Create one guest record (name + mobile).",
      successFeedback: "Guest saved. You can add service notes when you record their visit.",
    },
    4: {
      message: "Record today's visit for that guest.",
      expectedAction: "Add one visit entry — e.g. massage, facial, body treatment.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
    },
    5: {
      message: "Add one appointment for a treatment.",
      expectedAction: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a first-time discount or package deal.",
      expectedAction: "Select a promo type and save.",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. visit 4 times, get 1 free treatment.",
      expectedAction: "Set a visit threshold and reward.",
      successFeedback: "Loyalty is active. Returning guests can now earn rewards.",
    },
  },
  gym: {
    3: {
      message: "Add your first member — for example, someone who signed up or came for a session today.",
      expectedAction: "Create one member record (name + mobile).",
      successFeedback: "Member saved. You can track attendance.",
    },
    4: {
      message: "Record today's session or check-in for that member.",
      expectedAction: "Add one visit entry — e.g. gym session, class attendance.",
      successFeedback: "Visit recorded. This helps with follow-up and retention.",
    },
    5: {
      message: "Add one class or personal training appointment.",
      expectedAction: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a trial pass or referral discount.",
      expectedAction: "Select a promo type and save.",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. attend 8 classes, get 1 free.",
      expectedAction: "Set a visit threshold and reward.",
      successFeedback: "Loyalty is active. Members can now earn rewards.",
    },
  },
  retail: {
    3: {
      message: "Add your first customer — for example, someone who made a purchase today.",
      expectedAction: "Create one customer (name + mobile).",
      successFeedback: "Customer saved. You can track repeat purchases.",
    },
    4: {
      message: "Record today's purchase or visit for that customer.",
      expectedAction: "Add one visit entry.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
    },
    5: {
      message: "Add one appointment if you take bookings (e.g. consultations).",
      expectedAction: "Create one booking for today or tomorrow, or skip if not applicable.",
      successFeedback: "Appointment added. Your schedule is now active.",
    },
    6: {
      message: "Create one simple offer — for example, a sale or membership discount.",
      expectedAction: "Select a promo type and save.",
      successFeedback: "Promo ready. You can turn it on or off anytime.",
    },
    7: {
      message: "Enable one loyalty rule — e.g. visit 5 times, get 10% off next purchase.",
      expectedAction: "Set a visit threshold and reward.",
      successFeedback: "Loyalty is active. Returning customers can now earn rewards.",
    },
  },
};

/** Get step guidance personalized by business type. Falls back to default if no override. */
export function getStepGuidance(
  step: number,
  businessType?: string | null
): StepGuidance {
  const byType =
    businessType && STEP_GUIDANCE_BY_BUSINESS_TYPE[businessType]
      ? STEP_GUIDANCE_BY_BUSINESS_TYPE[businessType][step]
      : undefined;
  return byType ?? STEP_GUIDANCE[step] ?? { message: "", expectedAction: "", successFeedback: "" };
}

/** Ultra-simple first-run: 3 critical tasks only */
export const CRITICAL_FIRST_TASKS: ChecklistItem[] = [
  { label: "Complete Business Setup", href: "/setup" },
  {
    label: "Add your first customer",
    href: "/customers",
    requires: { business: 1 },
    lockedMessage: "Complete Business Setup first",
  },
  {
    label: "Record one visit or add one follow-up reminder",
    href: "/customers",
    requires: { customer: 1 },
    lockedMessage: "Add at least 1 customer first",
  },
];

// Prerequisites: task is unlocked when all conditions are met
export interface ChecklistRequires {
  business?: number;
  customer?: number;
  appointment?: number;
  promo?: number;
}

// First 7 days checklist — each item has a link and optional prerequisites
export interface ChecklistItem {
  label: string;
  href?: string;
  /** Task is blocked until these counts are met. Sequential within each day. */
  requires?: ChecklistRequires;
  /** Shown when locked, e.g. "Complete Business Setup first" */
  lockedMessage?: string;
}

export const CHECKLIST_DAYS: Record<number, ChecklistItem[]> = {
  1: [
    { label: "Complete Business Setup", href: "/setup" },
    {
      label: "Add 1 customer",
      href: "/customers",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Record 1 visit",
      href: "/customers",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
  ],
  2: [
    {
      label: "Add 2 more customers",
      href: "/customers",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Add 1 appointment",
      href: "/appointments",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
    { label: "Check Dashboard once in the morning", href: "/dashboard" },
  ],
  3: [
    {
      label: "Record visits for all customers served today",
      href: "/customers",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
    {
      label: "Edit one customer record (practice correction)",
      href: "/customers",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
    {
      label: "Mark one appointment as completed",
      href: "/appointments",
      requires: { appointment: 1 },
      lockedMessage: "Add at least 1 appointment first",
    },
  ],
  4: [
    {
      label: "Create 1 simple promo",
      href: "/promos",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Mention promo to at least 3 customers",
      href: "/customers",
      requires: { promo: 1, customer: 1 },
      lockedMessage: "Create a promo and add customers first",
    },
    { label: "Check Dashboard end-of-day", href: "/dashboard" },
  ],
  5: [
    {
      label: "Enable loyalty rule",
      href: "/loyalty",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Record at least 3 visits",
      href: "/customers",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
    {
      label: "Confirm points/stamps are updating correctly",
      href: "/loyalty",
      requires: { customer: 1 },
      lockedMessage: "Add customers and record visits first",
    },
  ],
  6: [
    {
      label: "Import a small batch of existing customers (or add 3 manually)",
      href: "/imports",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Check for duplicates",
      href: "/imports",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Fix one customer detail to build confidence",
      href: "/customers",
      requires: { customer: 1 },
      lockedMessage: "Add at least 1 customer first",
    },
  ],
  7: [
    {
      label: "Review Insights (basic counts only)",
      href: "/insights",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    {
      label: "Identify busiest day/time from the week",
      href: "/insights",
      requires: { business: 1 },
      lockedMessage: "Complete Business Setup first",
    },
    { label: "Set one routine: Update app before closing each day", href: "/dashboard" },
  ],
};

export function getChecklistForDay(day: number): ChecklistItem[] {
  if (day === 1) return CRITICAL_FIRST_TASKS;
  return CHECKLIST_DAYS[day] ?? [];
}

/** Check if a checklist item is unlocked given account counts */
export function isChecklistItemUnlocked(
  item: ChecklistItem,
  counts: { businesses: number; customers: number; appointments: number; promos: number },
): boolean {
  if (!item.requires) return true;
  const r = item.requires;
  if (r.business != null && counts.businesses < r.business) return false;
  if (r.customer != null && counts.customers < r.customer) return false;
  if (r.appointment != null && counts.appointments < r.appointment) return false;
  if (r.promo != null && counts.promos < r.promo) return false;
  return true;
}

/** Routes allowed when onboarding is incomplete, per step. Empty = only /onboarding allowed. */
export const STEP_ALLOWED_PATHS: Record<number, string[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
};

/** Check if path is allowed for the given onboarding step (1-8). /onboarding is always allowed. */
export function isPathAllowedForStep(step: number, pathname: string): boolean {
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  const allowed = STEP_ALLOWED_PATHS[step] ?? [];
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Tooltip copy for key screens
export const TOOLTIP_COPY = {
  dashboard: "This is your daily control panel. Start with the top task.",
  customers: "Save every customer once, then just update when they return.",
  appointments: "Use this to see today and tomorrow at a glance.",
  promos: "Keep offers simple so customers understand quickly.",
  insights: "These numbers show what happened this week in plain terms.",
  loyalty: "Reward repeat visits with one easy rule your staff can explain.",
  import: "Import in small batches first, then review before continuing.",
};

// Reassurance messages
export const REASSURANCE_MESSAGES = [
  "You can edit this later.",
  "Nothing is final until you confirm.",
  "Your existing records are safe.",
  "Saved successfully.",
  "If this looks wrong, you can undo this step.",
  "You are in Practice Day. Real data is not affected.",
  "You can skip this now and return anytime.",
  "Only you and your team can see this business data.",
];
