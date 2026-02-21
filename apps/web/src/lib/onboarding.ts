/**
 * Onboarding configuration for the /onboarding wizard flow.
 */

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
