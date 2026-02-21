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
  title: string;
  whatThisIs: string;
  whyThisMatters: string;
  doThisNow: string;
  successFeedback: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  allowSkip?: boolean;
};

export const STEP_GUIDANCE: Record<number, StepGuidance> = {
  1: {
    title: "Set up your business",
    whatThisIs: "We need your business name and type to personalize Suki for you.",
    whyThisMatters: "This lets us show you the right terms and suggestions (e.g. customers vs patients, appointments vs bookings).",
    doThisNow: "Enter your business name and select your business type below.",
    successFeedback: "Your business profile is ready. You can edit this anytime in Settings.",
    primaryActionLabel: "Create business",
  },
  2: {
    title: "Your daily dashboard",
    whatThisIs: "Your dashboard is your daily home screen. It shows the three most important actions to focus on each day.",
    whyThisMatters: "Starting with one clear action at a time helps you avoid feeling overwhelmed and reduces missed tasks.",
    doThisNow: "Review the three action cards below. When you finish setup, your real dashboard will show these same options.",
    successFeedback: "You're ready to move on. Your dashboard will guide you each day.",
    primaryActionLabel: "I understand this screen",
    secondaryActionLabel: "Show this again later",
    allowSkip: true,
  },
  3: {
    title: "Add your first customer",
    whatThisIs: "A customer record is simply a name and optional phone number — like an entry in your notebook.",
    whyThisMatters: "Once you have customers saved, you can record visits, schedule appointments, and send offers.",
    doThisNow: "Enter one customer's name below. Add their mobile number if you have it.",
    successFeedback: "Customer saved. You can add or update details anytime.",
    primaryActionLabel: "Save customer and continue",
  },
  4: {
    title: "Record a visit",
    whatThisIs: "Recording a visit means logging that a customer came in today — for a haircut, consultation, meal, or purchase.",
    whyThisMatters: "This helps you track repeat customers and know who to follow up with or reward.",
    doThisNow: "Select the customer you just added and record their visit.",
    successFeedback: "Visit recorded. This helps with follow-up and rewards.",
    primaryActionLabel: "Record visit and continue",
  },
  5: {
    title: "Add an appointment",
    whatThisIs: "Appointments help you see your day at a glance — who's coming and when.",
    whyThisMatters: "A clear schedule reduces no-shows and helps you plan your staff and resources.",
    doThisNow: "Create one appointment for today or tomorrow with the customer you added.",
    successFeedback: "Appointment added. Your schedule is now active.",
    primaryActionLabel: "Create appointment and continue",
  },
  6: {
    title: "Create your first offer",
    whatThisIs: "An offer is a special you can share with customers — like a discount, free add-on, or reminder.",
    whyThisMatters: "Simple offers help bring customers back and make them feel valued.",
    doThisNow: "Choose an offer type and add a short message. We'll pre-fill an example you can edit.",
    successFeedback: "Offer ready. You can turn it on or off anytime.",
    primaryActionLabel: "Create offer and continue",
  },
  7: {
    title: "Set your customer rewards",
    whatThisIs: "A reward program gives customers something after a certain number of visits — like every 5 visits, get a free treatment.",
    whyThisMatters: "Rewards encourage repeat visits and help you keep regular customers coming back.",
    doThisNow: "Set how many visits before a reward unlocks (e.g. 5). You can refine this later.",
    successFeedback: "Rewards are active. Returning customers can now earn benefits.",
    primaryActionLabel: "Save and continue",
  },
  8: {
    title: "Finish setup",
    whatThisIs: "You're almost done. If you already have a customer list elsewhere, you can paste names or notes here for later import.",
    whyThisMatters: "Importing in small batches lets you review each group before adding more. You can also skip and import later.",
    doThisNow: "Paste any names or notes below if you want, or simply finish. You can always import more customers later.",
    successFeedback: "Setup complete. Welcome to Suki!",
    primaryActionLabel: "Finish setup",
    secondaryActionLabel: "Skip import for now",
    allowSkip: true,
  },
};

/** Business-type-specific guidance for personalized onboarding scenarios */
export const STEP_GUIDANCE_BY_BUSINESS_TYPE: Record<
  string,
  Partial<Record<number, Partial<StepGuidance>>>
> = {
  salon: {
    3: {
      title: "Add your first customer",
      whatThisIs: "Add someone who came in for a haircut or treatment today — like a walk-in or regular.",
      whyThisMatters: "Once you have customers saved, you can record their services and track repeat visits.",
      doThisNow: "Enter their name and mobile if you have it.",
      successFeedback: "Customer saved. You can add service notes when you record their visit.",
      primaryActionLabel: "Save customer and continue",
    },
    4: {
      whatThisIs: "Record today's visit for that customer so we can track repeat visits.",
      whyThisMatters: "This helps with follow-up reminders and loyalty rewards.",
      doThisNow: "Add one visit entry — e.g. haircut, color, treatment.",
      successFeedback: "Visit recorded. This helps with follow-up and rewards.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one appointment so you can see your day at a glance.",
      whyThisMatters: "A clear schedule helps you plan stylists and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow (e.g. haircut, blow-dry).",
      successFeedback: "Appointment added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a weekday discount for regulars.",
      whyThisMatters: "Offers bring customers back and make them feel valued.",
      doThisNow: "Select an offer type and save (e.g. 20% off haircut for new customers).",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. visit 5 times, get 1 free haircut.",
      whyThisMatters: "Rewards encourage repeat visits and keep regulars coming back.",
      doThisNow: "Set a visit threshold and reward (e.g. free add-on, discount).",
      successFeedback: "Rewards are active. Returning customers can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
  clinic: {
    3: {
      title: "Add your first patient",
      whatThisIs: "Add someone who came for a consultation today.",
      whyThisMatters: "Once you have patients saved, you can record visits and schedule follow-ups.",
      doThisNow: "Create one patient record (name + mobile).",
      successFeedback: "Patient saved. You can add notes when you record their visit.",
      primaryActionLabel: "Save patient and continue",
    },
    4: {
      whatThisIs: "Record today's visit for that patient so we can track follow-ups.",
      whyThisMatters: "This helps with follow-up reminders and care continuity.",
      doThisNow: "Add one visit entry — e.g. consultation, follow-up, procedure.",
      successFeedback: "Visit recorded. This helps with follow-up and reminders.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one appointment so you can see your schedule.",
      whyThisMatters: "A clear schedule helps you plan and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a reminder for check-ups.",
      whyThisMatters: "Reminders help patients come back for follow-up care.",
      doThisNow: "Select an offer type and save (e.g. follow-up reminder).",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. visit 4 times, get a discount on next visit.",
      whyThisMatters: "Rewards encourage repeat visits and patient loyalty.",
      doThisNow: "Set a visit threshold and reward.",
      successFeedback: "Rewards are active. Returning patients can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
  restaurant: {
    3: {
      whatThisIs: "Add someone who ordered takeout or dined in today.",
      whyThisMatters: "Once you have customers saved, you can track repeat orders and visits.",
      doThisNow: "Create one customer (name + mobile).",
      successFeedback: "Customer saved. You can track repeat orders.",
      primaryActionLabel: "Save customer and continue",
    },
    4: {
      whatThisIs: "Record today's order or visit for that customer.",
      whyThisMatters: "This helps with follow-up and loyalty rewards.",
      doThisNow: "Add one visit entry — e.g. dine-in, takeout, delivery.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one reservation or order booking.",
      whyThisMatters: "A clear schedule helps you plan seating and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow.",
      successFeedback: "Booking added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a weekday special or birthday discount.",
      whyThisMatters: "Offers bring customers back and boost repeat visits.",
      doThisNow: "Select an offer type and save.",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. visit 5 times, get a free drink or dessert.",
      whyThisMatters: "Rewards encourage repeat visits and keep regulars coming back.",
      doThisNow: "Set a visit threshold and reward.",
      successFeedback: "Rewards are active. Returning customers can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
  spa: {
    3: {
      title: "Add your first guest",
      whatThisIs: "Add someone who came for a massage or facial today.",
      whyThisMatters: "Once you have guests saved, you can record treatments and track repeat visits.",
      doThisNow: "Create one guest record (name + mobile).",
      successFeedback: "Guest saved. You can add service notes when you record their visit.",
      primaryActionLabel: "Save guest and continue",
    },
    4: {
      whatThisIs: "Record today's visit for that guest.",
      whyThisMatters: "This helps with follow-up and loyalty rewards.",
      doThisNow: "Add one visit entry — e.g. massage, facial, body treatment.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one appointment for a treatment.",
      whyThisMatters: "A clear schedule helps you plan therapists and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a first-time discount or package deal.",
      whyThisMatters: "Offers bring guests back and make them feel valued.",
      doThisNow: "Select an offer type and save.",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. visit 4 times, get 1 free treatment.",
      whyThisMatters: "Rewards encourage repeat visits and keep regulars coming back.",
      doThisNow: "Set a visit threshold and reward.",
      successFeedback: "Rewards are active. Returning guests can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
  gym: {
    3: {
      title: "Add your first member",
      whatThisIs: "Add someone who signed up or came for a session today.",
      whyThisMatters: "Once you have members saved, you can track attendance and visits.",
      doThisNow: "Create one member record (name + mobile).",
      successFeedback: "Member saved. You can track attendance.",
      primaryActionLabel: "Save member and continue",
    },
    4: {
      whatThisIs: "Record today's session or check-in for that member.",
      whyThisMatters: "This helps with follow-up and retention.",
      doThisNow: "Add one visit entry — e.g. gym session, class attendance.",
      successFeedback: "Visit recorded. This helps with follow-up and retention.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one class or personal training appointment.",
      whyThisMatters: "A clear schedule helps you plan and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow.",
      successFeedback: "Appointment added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a trial pass or referral discount.",
      whyThisMatters: "Offers help attract new members and bring others back.",
      doThisNow: "Select an offer type and save.",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. attend 8 classes, get 1 free.",
      whyThisMatters: "Rewards encourage attendance and member loyalty.",
      doThisNow: "Set a visit threshold and reward.",
      successFeedback: "Rewards are active. Members can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
  retail: {
    3: {
      whatThisIs: "Add someone who made a purchase today.",
      whyThisMatters: "Once you have customers saved, you can track repeat purchases.",
      doThisNow: "Create one customer (name + mobile).",
      successFeedback: "Customer saved. You can track repeat purchases.",
      primaryActionLabel: "Save customer and continue",
    },
    4: {
      whatThisIs: "Record today's purchase or visit for that customer.",
      whyThisMatters: "This helps with follow-up and loyalty rewards.",
      doThisNow: "Add one visit entry.",
      successFeedback: "Visit recorded. This helps with follow-up and loyalty.",
      primaryActionLabel: "Record visit and continue",
    },
    5: {
      whatThisIs: "Add one appointment if you take bookings (e.g. consultations).",
      whyThisMatters: "A clear schedule helps you plan and reduce no-shows.",
      doThisNow: "Create one booking for today or tomorrow, or skip if not applicable.",
      successFeedback: "Appointment added. Your schedule is now active.",
      primaryActionLabel: "Create appointment and continue",
    },
    6: {
      whatThisIs: "Create one simple offer — for example, a sale or membership discount.",
      whyThisMatters: "Offers bring customers back and boost repeat purchases.",
      doThisNow: "Select an offer type and save.",
      successFeedback: "Offer ready. You can turn it on or off anytime.",
      primaryActionLabel: "Create offer and continue",
    },
    7: {
      whatThisIs: "Set a reward — e.g. visit 5 times, get 10% off next purchase.",
      whyThisMatters: "Rewards encourage repeat visits and keep regulars coming back.",
      doThisNow: "Set a visit threshold and reward.",
      successFeedback: "Rewards are active. Returning customers can now earn benefits.",
      primaryActionLabel: "Save and continue",
    },
  },
};

/** Merge default guidance with business-type overrides. Overrides can be partial. */
function mergeGuidance(
  base: StepGuidance,
  override: Partial<StepGuidance> | undefined
): StepGuidance {
  if (!override) return base;
  return {
    title: override.title ?? base.title,
    whatThisIs: override.whatThisIs ?? base.whatThisIs,
    whyThisMatters: override.whyThisMatters ?? base.whyThisMatters,
    doThisNow: override.doThisNow ?? base.doThisNow,
    successFeedback: override.successFeedback ?? base.successFeedback,
    primaryActionLabel: override.primaryActionLabel ?? base.primaryActionLabel,
    secondaryActionLabel: override.secondaryActionLabel ?? base.secondaryActionLabel,
    allowSkip: override.allowSkip ?? base.allowSkip,
  };
}

/** Get step guidance personalized by business type. Falls back to default if no override. */
export function getStepGuidance(
  step: number,
  businessType?: string | null
): StepGuidance {
  const base = STEP_GUIDANCE[step];
  if (!base) {
    return {
      title: "",
      whatThisIs: "",
      whyThisMatters: "",
      doThisNow: "",
      successFeedback: "",
      primaryActionLabel: "Continue",
    };
  }
  const byType =
    businessType && STEP_GUIDANCE_BY_BUSINESS_TYPE[businessType]
      ? STEP_GUIDANCE_BY_BUSINESS_TYPE[businessType][step]
      : undefined;
  return mergeGuidance(base, byType);
}

/** Routes allowed when onboarding is incomplete, per step. Users can finish setup later. */
export const STEP_ALLOWED_PATHS: Record<number, string[]> = {
  1: ["/dashboard"],
  2: ["/dashboard"],
  3: ["/dashboard"],
  4: ["/dashboard"],
  5: ["/dashboard"],
  6: ["/dashboard"],
  7: ["/dashboard"],
  8: ["/dashboard"],
};

/** Check if path is allowed for the given onboarding step (1-8). /onboarding is always allowed. */
export function isPathAllowedForStep(step: number, pathname: string): boolean {
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  const allowed = STEP_ALLOWED_PATHS[step] ?? [];
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
