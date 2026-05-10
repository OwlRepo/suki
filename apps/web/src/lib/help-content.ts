import { STEP_GUIDANCE } from "./onboarding";

export type HelpLocale = "en" | "tl";

export type HelpSectionKey =
  | "getting-started"
  | "daily-tasks"
  | "billing-usage"
  | "troubleshooting";

export type HelpArticle = {
  id: string;
  title: string;
  locale: HelpLocale;
  sectionKey: HelpSectionKey;
  intents: string[];
  steps: string[];
  relatedRoutes: string[];
  quickAnswer: string;
  lastUpdated: string;
};

export type OnboardingGuideModule = {
  id: string;
  sourceStepId: number;
  locale: HelpLocale;
  title: string;
  summary: string;
  relatedRoute: string;
};

export type HelpSearchResult = HelpArticle & { score: number };

const TODAY = "2026-05-10";

export const HELP_CONTENT: HelpArticle[] = [
  {
    id: "getting-started-setup-en",
    title: "Set Up Your Business",
    locale: "en",
    sectionKey: "getting-started",
    intents: ["setup", "start", "onboarding", "create business"],
    steps: ["Open Setup", "Add business name", "Select business type", "Save"],
    relatedRoutes: ["/setup", "/onboarding"],
    quickAnswer: "Open Setup, enter business name and type, then save to continue onboarding.",
    lastUpdated: TODAY,
  },
  {
    id: "getting-started-setup-tl",
    title: "I-setup ang Iyong Negosyo",
    locale: "tl",
    sectionKey: "getting-started",
    intents: ["paano mag setup", "simula", "onboarding", "negosyo"],
    steps: ["Buksan ang Setup", "Ilagay ang pangalan", "Piliin ang type", "I-save"],
    relatedRoutes: ["/setup", "/onboarding"],
    quickAnswer: "Pumunta sa Setup, ilagay ang pangalan at uri ng negosyo, tapos i-save.",
    lastUpdated: TODAY,
  },
  {
    id: "daily-add-customer-en",
    title: "Add a Customer",
    locale: "en",
    sectionKey: "daily-tasks",
    intents: ["add customer", "new customer", "customer list"],
    steps: ["Go to Customers", "Tap Add customer", "Fill details", "Save"],
    relatedRoutes: ["/customers"],
    quickAnswer: "Go to Customers, tap Add customer, then save name and phone.",
    lastUpdated: TODAY,
  },
  {
    id: "daily-add-customer-tl",
    title: "Magdagdag ng Customer",
    locale: "tl",
    sectionKey: "daily-tasks",
    intents: ["paano mag add ng customer", "dagdag customer", "customer list"],
    steps: ["Pumunta sa Customers", "Pindutin ang Add customer", "Ilagay ang detalye", "I-save"],
    relatedRoutes: ["/customers"],
    quickAnswer: "Sa Customers, pindutin ang Add customer, ilagay ang pangalan at mobile, saka i-save.",
    lastUpdated: TODAY,
  },
  {
    id: "billing-sms-en",
    title: "Check SMS Credits Remaining",
    locale: "en",
    sectionKey: "billing-usage",
    intents: ["sms left", "sms remaining", "credits", "usage"],
    steps: ["Open Settings", "Open usage section", "View SMS remaining"],
    relatedRoutes: ["/settings", "/analytics"],
    quickAnswer: "Open usage pages to view SMS used, total credits, and remaining balance.",
    lastUpdated: TODAY,
  },
  {
    id: "billing-sms-tl",
    title: "Suriin ang Natitirang SMS",
    locale: "tl",
    sectionKey: "billing-usage",
    intents: ["ilang sms pa", "natitirang sms", "usage"],
    steps: ["Buksan ang Settings", "Pumunta sa usage", "Tingnan ang natitira"],
    relatedRoutes: ["/settings", "/analytics"],
    quickAnswer: "Makikita sa usage ang nagamit na SMS, total credits, at natitirang SMS.",
    lastUpdated: TODAY,
  },
];

export function searchHelpContent(query: string, locale: HelpLocale): HelpSearchResult[] {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const filtered = HELP_CONTENT.filter((item) => item.locale === locale);
  if (!q) return filtered.map((item) => ({ ...item, score: 0 }));

  const scored = filtered
    .map((item) => {
      const haystack = [item.title, item.quickAnswer, ...item.intents, ...item.steps].join(" ").toLowerCase();
      const exact = item.intents.some((intent) => intent.toLowerCase().includes(q)) ? 5 : 0;
      const title = item.title.toLowerCase().includes(q) ? 3 : 0;
      const body = haystack.includes(q) ? 1 : 0;
      const tokenHits = tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
      return { ...item, score: exact + title + body + tokenHits };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored;
}

export function getGuidedOnboardingModules(locale: HelpLocale): OnboardingGuideModule[] {
  const fallbackSummary = locale === "tl" ? "Sundan ang step na ito para matapos ang setup." : "Follow this step to complete setup.";
  const sortedSteps = Object.entries(STEP_GUIDANCE)
    .map(([key, value]) => ({ sourceStepId: Number(key), value }))
    .sort((a, b) => a.sourceStepId - b.sourceStepId);

  return sortedSteps.map(({ sourceStepId, value }) => ({
    id: `onboarding-step-${sourceStepId}-${locale}`,
    sourceStepId,
    locale,
    title: value.title,
    summary: value.whatThisIs || fallbackSummary,
    relatedRoute: "/onboarding",
  }));
}
