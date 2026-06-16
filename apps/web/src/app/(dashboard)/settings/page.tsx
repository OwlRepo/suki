"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  Building2,
  FileText,
  Mail,
  PlusCircle,
  Search,
  Settings2,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsSectionCard } from "@/components/ui/settings-section-card";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useWorkspace } from "@/contexts/workspace-context";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsSectionSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { fromError } from "@/lib/ui-feedback";
import { getPlanCapabilities } from "@/lib/plan-capabilities";
import { isDevMode } from "@/lib/dev-mode";
import {
  clearDevOverrides,
  getDevApiUrl,
  getDevMockFailure,
  getDevMockLatencyMs,
  setDevApiUrl,
  setDevMockFailure,
  setDevMockLatencyMs,
} from "@/lib/dev-store";

const SETTINGS_SECTION_IDS = [
  "organization",
  "businesses",
  "automation",
  "customer-templates",
  "messaging",
  "ai-usage",
  "dev-tools",
] as const;

const SETTINGS_SEARCH_INDEX: Record<
  (typeof SETTINGS_SECTION_IDS)[number],
  string[]
> = {
  organization: ["organization", "workspace", "name", "email", "receipt"],
  businesses: ["businesses", "business", "crm", "customers", "appointments"],
  automation: [
    "automation",
    "reminders",
    "appointment",
    "inactivity",
    "winback",
    "follow-up",
    "sms",
    "email",
    "channel",
  ],
  "customer-templates": [
    "customer",
    "description",
    "template",
    "notes",
    "default",
    "add customer",
  ],
  messaging: ["messaging", "sms", "usage", "text", "credits"],
  "ai-usage": ["ai", "usage", "tokens", "quota", "limit", "soft cap"],
  "dev-tools": ["dev", "developer", "simulation", "mock", "api"],
};

interface Organization {
  id: string;
  name: string;
}

interface Business {
  id: string;
  name: string;
  businessType: string;
  crmMode?: "lite" | "full";
}

interface BillingStatus {
  status: string;
  planType: string;
  readOnly?: boolean;
  billingStatus?: string;
  currentPlan?: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  isReadOnly?: boolean;
  nextBillingDueAt?: string | null;
  manualBillingNotes?: string | null;
  accessEndsAt?: string | null;
  subscription: {
    planType?: string;
    status?: string;
    currentPeriodEnd?: string;
  } | null;
}

interface SmsUsage {
  included: number;
  addon: number;
  used: number;
  total: number;
  remaining: number;
  pausedReason: string;
  at80Pct: boolean;
  at100Pct: boolean;
}

interface AutomationSettingsApi {
  id?: string;
  businessId?: string;
  appointmentRemindersEnabled: boolean;
  appointmentReminder72hEnabled: boolean;
  inactivityWinbackEnabled: boolean;
  inactivityDays: number;
  autoSendChannel: "sms" | "email";
  messageTemplates?: MessageTemplateMap;
}

interface CustomerTemplate {
  id: string;
  name: string;
  fieldsConfig: Array<{ key: string; label: string; placeholder?: string }>;
}

const PAUSED_REASON_MESSAGES: Record<string, string> = {
  none: "",
  cap_reached: "SMS cap reached for this period.",
  billing_past_due: "Messages paused due to account status.",
  provider_down: "SMS provider temporarily unavailable. Messages will retry.",
  manual_pause: "Messaging is manually paused.",
};

const AUTOMATION_TEMPLATE_KEYS = [
  "appointment_confirmation",
  "appointment_reminder_24h",
  "appointment_reminder_72h",
  "missed_recovery",
  "post_visit_followup",
  "inactivity_winback",
  "loyalty_unlock",
] as const;

type AutomationTemplateKey = (typeof AUTOMATION_TEMPLATE_KEYS)[number];

type MessageTemplateMap = Partial<
  Record<AutomationTemplateKey, { sms?: string; email?: string }>
>;

const DEFAULT_MESSAGE_TEMPLATES: Record<
  AutomationTemplateKey,
  { sms: string; email: string }
> = {
  appointment_confirmation: {
    sms: "Hi {customerName}! Your appointment{staffName} is confirmed for {dateTime}.",
    email:
      "Hi {customerName}, your appointment{staffName} is confirmed for {dateTime}.",
  },
  appointment_reminder_24h: {
    sms: "Reminder: Your appointment{staffName} is tomorrow. Reschedule: {link}.",
    email:
      "Reminder: Your appointment{staffName} is tomorrow. Reschedule here: {link}.",
  },
  appointment_reminder_72h: {
    sms: "Reminder: Your appointment{staffName} is in 3 days. Reschedule: {link}.",
    email:
      "Reminder: Your appointment{staffName} is in 3 days. Reschedule here: {link}.",
  },
  missed_recovery: {
    sms: "We noticed you missed your appointment. We'd love to see you—rebook here: {link}.",
    email:
      "We noticed you missed your appointment. We'd love to see you again. Rebook here: {link}.",
  },
  post_visit_followup: {
    sms: "Thank you for visiting! We hope to see you again soon. Book your next visit: {link}.",
    email:
      "Thank you for visiting! We hope to see you again soon. Book your next visit here: {link}.",
  },
  inactivity_winback: {
    sms: "We miss you! Come back and save on your next visit.",
    email: "We miss you! Come back soon and enjoy your next visit.",
  },
  loyalty_unlock: {
    sms: "Congratulations! You've unlocked your reward. Claim it on your next visit.",
    email:
      "Congratulations! You've unlocked your reward. Claim it on your next visit.",
  },
};

function mergeMessageTemplateDefaults(
  templates?: MessageTemplateMap,
): MessageTemplateMap {
  const incoming = templates ?? {};

  return Object.fromEntries(
    AUTOMATION_TEMPLATE_KEYS.map((key) => [
      key,
      {
        ...DEFAULT_MESSAGE_TEMPLATES[key],
        ...(incoming[key] ?? {}),
      },
    ]),
  ) as MessageTemplateMap;
}

function SettingGroupHeader({
  icon: Icon,
  title,
  description,
  iconClassName = "bg-blue-50 text-blue-600",
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        <Icon className="size-5" />
      </span>

      <div>
        <p className="font-bold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function SettingsPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const flags = useFeatureFlags();

  const [, setOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [editingBiz, setEditingBiz] = useState<string | null>(null);
  const [editBizName, setEditBizName] = useState("");
  const [devApiUrl, setDevApiUrlState] = useState("");
  const [devMockLatencyMs, setDevMockLatencyMsState] = useState(0);
  const [devMockFailure, setDevMockFailureState] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [aiPoliciesLoading, setAiPoliciesLoading] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [templateSaveFeedback, setTemplateSaveFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [smsUsage, setSmsUsage] = useState<SmsUsage | null>(null);

  const [emailUsage, setEmailUsage] = useState<{
    included: number;
    used: number;
    total: number;
    remaining: number;
    at80Pct: boolean;
    at100Pct: boolean;
  } | null>(null);

  const [aiUsage, setAiUsage] = useState<{
    plan: string;
    month: string;
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
    aiEnabled: boolean;
    softCapPct: number;
    allowedFeatures: string[];
    resetDate: string;
    dailyTokensUsed?: number;
    dailyTokensLimit?: number;
    dailyTokensRemaining?: number;
    dailyRequestsUsed?: number;
    dailyRequestsLimit?: number;
    dailyRequestsRemaining?: number;
    dailyResetDateTime?: string;
    projectedDaysToLimit: number | null;
  } | null>(null);

  const [aiBreakdown, setAiBreakdown] = useState<{
    items: Array<{ key: string; tokens: number; requests: number }>;
  } | null>(null);

  const automationDefaults: AutomationSettingsApi = {
    appointmentRemindersEnabled: true,
    appointmentReminder72hEnabled: false,
    inactivityWinbackEnabled: true,
    inactivityDays: 60,
    autoSendChannel: "sms",
    messageTemplates: mergeMessageTemplateDefaults(),
  };

  const [automationSettingsByBiz, setAutomationSettingsByBiz] = useState<
    Record<string, AutomationSettingsApi>
  >({});

  const [automationSavingByBiz, setAutomationSavingByBiz] = useState<
    Record<string, boolean>
  >({});

  const [inactivityDraftByBiz, setInactivityDraftByBiz] = useState<
    Record<string, string>
  >({});

  const [templatesByBiz, setTemplatesByBiz] = useState<
    Record<
      string,
      {
        templates: CustomerTemplate[];
        defaultTemplate: CustomerTemplate | null;
      }
    >
  >({});

  const [templateDefaultSavingByBiz, setTemplateDefaultSavingByBiz] = useState<
    Record<string, boolean>
  >({});

  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createTemplateName, setCreateTemplateName] = useState("");
  const [createTemplateBusinessId, setCreateTemplateBusinessId] =
    useState("__any__");

  const [createTemplateFields, setCreateTemplateFields] = useState<
    Array<{ label: string; placeholder: string }>
  >([{ label: "", placeholder: "" }]);

  const [createTemplateSaving, setCreateTemplateSaving] = useState(false);

  const planCapabilities = useMemo(
    () => getPlanCapabilities(billing?.planType ?? null),
    [billing?.planType],
  );

  const visibleSections = useMemo(() => {
    const query = settingsSearch.trim().toLowerCase();
    if (!query) return new Set(SETTINGS_SECTION_IDS);

    const matched = new Set<(typeof SETTINGS_SECTION_IDS)[number]>();

    for (const id of SETTINGS_SECTION_IDS) {
      const terms = SETTINGS_SEARCH_INDEX[id] ?? [];

      if (terms.some((term) => term.includes(query) || query.includes(term))) {
        matched.add(id);
      }
    }

    return matched;
  }, [settingsSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setDevApiUrlState(getDevApiUrl() ?? "");
    setDevMockLatencyMsState(getDevMockLatencyMs());
    setDevMockFailureState(getDevMockFailure());
  }, []);

  const refetchSmsUsage = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const usage = await apiRequest<SmsUsage>("/messaging/sms-usage", {
        token,
      });

      setSmsUsage(usage);
    } catch {
      // Ignore optional usage refresh errors.
    }
  };

  useEffect(() => {
    if (!syncData) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const [orgRes, bizRes, billRes, aiRes, breakdownRes, smsRes, emailRes] =
          await Promise.all([
            apiRequest<{ organization: Organization }>("/organizations/me", {
              token,
            }),
            apiRequest<{ businesses: Business[] }>("/businesses", { token }),
            apiRequest<BillingStatus>("/billing/status", { token }),
            apiRequest<{
              plan: string;
              month: string;
              tokensUsed: number;
              tokensLimit: number;
              requestsUsed: number;
              requestsLimit: number;
              aiEnabled: boolean;
              softCapPct: number;
              allowedFeatures: string[];
              resetDate: string;
              dailyTokensUsed?: number;
              dailyTokensLimit?: number;
              dailyTokensRemaining?: number;
              dailyRequestsUsed?: number;
              dailyRequestsLimit?: number;
              dailyRequestsRemaining?: number;
              dailyResetDateTime?: string;
              projectedDaysToLimit: number | null;
            }>("/ai/usage/summary", { token }).catch(() => null),
            apiRequest<{
              items: Array<{ key: string; tokens: number; requests: number }>;
            }>("/ai/usage/breakdown?groupBy=feature", { token }).catch(
              () => null,
            ),
            apiRequest<SmsUsage>("/messaging/sms-usage", { token }).catch(
              () => null,
            ),
            apiRequest<{
              included: number;
              used: number;
              total: number;
              remaining: number;
              at80Pct: boolean;
              at100Pct: boolean;
            }>("/messaging/email-usage", { token }).catch(() => null),
          ]);

        setOrg(orgRes.organization ?? null);
        setOrgName(orgRes.organization?.name ?? "");
        setBusinesses(bizRes.businesses);
        setBilling(billRes);
        setAiUsage(aiRes);
        setAiBreakdown(breakdownRes ?? null);
        setSmsUsage(smsRes ?? null);
        setEmailUsage(emailRes ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  useEffect(() => {
    const addon = searchParams?.get("addon");

    if (addon === "success") {
      setFeedback({
        type: "success",
        message: "Credits updated successfully.",
      });

      setTimeout(() => setFeedback(null), 5000);
      refetchSmsUsage();
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!businesses.length) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const results = await Promise.all(
          businesses.map(async (business) => {
            const settings = await apiRequest<AutomationSettingsApi>(
              `/automation/settings?businessId=${encodeURIComponent(
                business.id,
              )}`,
              { token },
            ).catch(() => automationDefaults);

            return {
              ...automationDefaults,
              ...settings,
              id: settings?.id,
              businessId: business.id,
              appointmentRemindersEnabled:
                settings?.appointmentRemindersEnabled ??
                automationDefaults.appointmentRemindersEnabled,
              appointmentReminder72hEnabled:
                settings?.appointmentReminder72hEnabled ??
                automationDefaults.appointmentReminder72hEnabled,
              inactivityWinbackEnabled:
                settings?.inactivityWinbackEnabled ??
                automationDefaults.inactivityWinbackEnabled,
              inactivityDays:
                typeof settings?.inactivityDays === "number"
                  ? settings.inactivityDays
                  : automationDefaults.inactivityDays,
              autoSendChannel:
                (settings?.autoSendChannel as "sms" | "email") ??
                automationDefaults.autoSendChannel,
              messageTemplates: mergeMessageTemplateDefaults(
                settings?.messageTemplates,
              ),
            };
          }),
        );

        const map: Record<string, AutomationSettingsApi> = {};

        for (const result of results) {
          map[result.businessId] = result as AutomationSettingsApi;
        }

        setAutomationSettingsByBiz(map);
      } catch {
        // Ignore optional automation settings errors.
      }
    })();
  }, [businesses, getToken]);

  useEffect(() => {
    if (!businesses.length) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const results = await Promise.all(
          businesses.map(async (business) => {
            const [templatesRes, defaultRes] = await Promise.all([
              apiRequest<{ templates: CustomerTemplate[] }>(
                `/customers/templates?businessId=${encodeURIComponent(
                  business.id,
                )}&businessType=${encodeURIComponent(
                  business.businessType ?? "",
                )}`,
                { token },
              ).catch(() => ({ templates: [] })),
              apiRequest<{ template: CustomerTemplate | null }>(
                `/customers/default-template?businessId=${encodeURIComponent(
                  business.id,
                )}`,
                { token },
              ).catch(() => ({ template: null })),
            ]);

            return {
              id: business.id,
              templates: templatesRes.templates ?? [],
              defaultTemplate: defaultRes.template ?? null,
            };
          }),
        );

        const map: Record<
          string,
          {
            templates: CustomerTemplate[];
            defaultTemplate: CustomerTemplate | null;
          }
        > = {};

        for (const result of results) {
          map[result.id] = {
            templates: result.templates,
            defaultTemplate: result.defaultTemplate,
          };
        }

        setTemplatesByBiz(map);
      } catch {
        // Ignore optional customer template errors.
      }
    })();
  }, [businesses, getToken]);

  const updateDefaultTemplate = async (
    businessId: string,
    templateIdOrDefault: string,
  ) => {
    const apiTemplateId =
      templateIdOrDefault === "default" ? null : templateIdOrDefault;

    setTemplateDefaultSavingByBiz((previous) => ({
      ...previous,
      [businessId]: true,
    }));

    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest("/customers/default-template", {
        method: "PATCH",
        token,
        body: JSON.stringify({ businessId, templateId: apiTemplateId }),
      });

      const data = templatesByBiz[businessId];
      const templates = data?.templates ?? [];

      const defaultTemplate =
        templateIdOrDefault === "default"
          ? templates.find((template) => template.id === "default") ?? null
          : templates.find((template) => template.id === templateIdOrDefault) ??
            null;

      setTemplatesByBiz((previous) => ({
        ...previous,
        [businessId]: { templates, defaultTemplate },
      }));

      setFeedback({
        type: "success",
        message: "Default template updated.",
      });

      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(error, "Failed to update default template."),
      });
    } finally {
      setTemplateDefaultSavingByBiz((previous) => ({
        ...previous,
        [businessId]: false,
      }));
    }
  };

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!createTemplateName.trim()) return;

    const fieldsConfig = createTemplateFields
      .filter((field) => field.label.trim())
      .map((field) => ({
        key: field.label
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, ""),
        label: field.label.trim(),
        placeholder: field.placeholder.trim() || undefined,
      }));

    if (fieldsConfig.length === 0) {
      setFeedback({
        type: "error",
        message: "Add at least one field with a label.",
      });
      return;
    }

    setCreateTemplateSaving(true);

    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest("/customers/templates", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: createTemplateName.trim(),
          businessId:
            createTemplateBusinessId === "__any__"
              ? undefined
              : createTemplateBusinessId,
          fieldsConfig,
        }),
      });

      setCreateTemplateOpen(false);
      setCreateTemplateName("");
      setCreateTemplateBusinessId("__any__");
      setCreateTemplateFields([{ label: "", placeholder: "" }]);

      setFeedback({
        type: "success",
        message: "Template created. It will appear in the list above.",
      });

      setTimeout(() => setFeedback(null), 3000);

      const results = await Promise.all(
        businesses.map(async (business) => {
          const [templatesRes, defaultRes] = await Promise.all([
            apiRequest<{ templates: CustomerTemplate[] }>(
              `/customers/templates?businessId=${encodeURIComponent(
                business.id,
              )}&businessType=${encodeURIComponent(
                business.businessType ?? "",
              )}`,
              { token },
            ).catch(() => ({ templates: [] })),
            apiRequest<{ template: CustomerTemplate | null }>(
              `/customers/default-template?businessId=${encodeURIComponent(
                business.id,
              )}`,
              { token },
            ).catch(() => ({ template: null })),
          ]);

          return {
            id: business.id,
            templates: templatesRes.templates ?? [],
            defaultTemplate: defaultRes.template ?? null,
          };
        }),
      );

      const map: Record<
        string,
        {
          templates: CustomerTemplate[];
          defaultTemplate: CustomerTemplate | null;
        }
      > = {};

      for (const result of results) {
        map[result.id] = {
          templates: result.templates,
          defaultTemplate: result.defaultTemplate,
        };
      }

      setTemplatesByBiz(map);
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(error, "Failed to create template."),
      });
    } finally {
      setCreateTemplateSaving(false);
    }
  };

  const handleSaveOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgName.trim()) return;

    setSavingOrg(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await apiRequest<{ organization: Organization }>(
        "/organizations/me",
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ name: orgName.trim() }),
        },
      );

      setOrg(response.organization);
      setFeedback({
        type: "success",
        message: "Organization name saved.",
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(error, "Failed to save. Please try again."),
      });
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBiz = async (id: string) => {
    if (!editBizName.trim()) return;

    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest(`/businesses/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: editBizName.trim() }),
      });

      setBusinesses((previous) =>
        previous.map((business) =>
          business.id === id
            ? { ...business, name: editBizName.trim() }
            : business,
        ),
      );

      setEditingBiz(null);

      setFeedback({
        type: "success",
        message: "Business name saved.",
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(
          error,
          "Failed to save business. Please try again.",
        ),
      });
    }
  };

  const handleCrmModeChange = async (id: string, crmMode: "lite" | "full") => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await apiRequest<{ business: Business }>(
        `/businesses/${id}/crm-mode`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ crmMode }),
        },
      );

      setBusinesses((previous) =>
        previous.map((business) =>
          business.id === id
            ? {
                ...business,
                crmMode: response.business.crmMode ?? business.crmMode,
              }
            : business,
        ),
      );

      workspace?.refetch();
    } catch (error) {
      setFeedback({
        type: "error",
        message: fromError(error, "Failed to update mode. Please try again."),
      });

      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const updateAutomationSettings = async (
    businessId: string,
    patch: Partial<AutomationSettingsApi>,
    successMessage = "Automation settings updated.",
    options: { suppressFeedback?: boolean; throwOnError?: boolean } = {},
  ) => {
    setAutomationSavingByBiz((previous) => ({
      ...previous,
      [businessId]: true,
    }));

    try {
      const token = await getToken();
      if (!token) return;

      const response = await apiRequest<AutomationSettingsApi>(
        "/automation/settings",
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ businessId, ...patch }),
        },
      );

      setAutomationSettingsByBiz((previous) => ({
        ...previous,
        [businessId]: {
          ...automationDefaults,
          ...previous[businessId],
          ...response,
          messageTemplates: mergeMessageTemplateDefaults(
            response.messageTemplates ??
              patch.messageTemplates ??
              previous[businessId]?.messageTemplates,
          ),
        } as AutomationSettingsApi,
      }));

      if (!options.suppressFeedback) {
        setFeedback({ type: "success", message: successMessage });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (error) {
      if (!options.suppressFeedback) {
        setFeedback({
          type: "error",
          message: fromError(error, "Failed to update. Please try again."),
        });
      }

      if (options.throwOnError) {
        throw error;
      }
    } finally {
      setAutomationSavingByBiz((previous) => ({
        ...previous,
        [businessId]: false,
      }));
    }
  };

  const sectionLabels: Record<(typeof SETTINGS_SECTION_IDS)[number], string> = {
    organization: "Organization",
    businesses: "Businesses",
    automation: "Automation",
    "customer-templates": "Customer Description Templates",
    messaging: "Messaging & SMS",
    "ai-usage": "AI Usage",
    "dev-tools": "Dev Tools",
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Settings"
        plainLanguageDescription="Manage your organization, businesses, automations, messaging, and AI limits."
        whatThisPageIsFor="Change your workspace name, business details, reminders, messaging, and AI settings."
        whatToDoNext="Use the search below to find a setting, or open any section to edit."
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />

        <Input
          type="search"
          value={settingsSearch}
          onChange={(event) => setSettingsSearch(event.target.value)}
          placeholder="Search settings (e.g. reminders, SMS, AI)"
          aria-label="Search settings"
          className="min-h-12 w-full rounded-xl border-slate-200 bg-white pl-10 pr-4 text-base shadow-sm"
        />
      </div>

      {settingsSearch.trim() ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Jump to</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {SETTINGS_SECTION_IDS.filter((id) => visibleSections.has(id)).map(
              (id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {sectionLabels[id]}
                </a>
              ),
            )}
          </div>

          {visibleSections.size === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No settings match &quot;{settingsSearch}&quot;. Try a different
              search.
            </p>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <StatusBanner
          variant={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      {templateSaveFeedback ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))]">
          <StatusBanner
            variant={templateSaveFeedback.type}
            message={templateSaveFeedback.message}
            role={templateSaveFeedback.type === "info" ? "status" : "alert"}
            onDismiss={() => setTemplateSaveFeedback(null)}
          />
        </div>
      ) : null}

      {!loading && smsUsage?.pausedReason && smsUsage.pausedReason !== "none" ? (
        <StatusBanner
          variant="warning"
          message={
            PAUSED_REASON_MESSAGES[smsUsage.pausedReason] ??
            `Messaging paused: ${smsUsage.pausedReason}`
          }
        />
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <SettingsSectionSkeleton />
          <SettingsSectionSkeleton />
          <SettingsSectionSkeleton />
        </div>
      ) : (
        <div className="space-y-4">
          <SettingsSectionCard
            id="organization"
            title="Organization"
            description="Your workspace name. Appears in emails and receipts. You can change it anytime."
            collapsedByDefault
            visible={visibleSections.has("organization")}
          >
            <div className="space-y-4">
              <SettingGroupHeader
                icon={Building2}
                title="Workspace details"
                description="Update the name customers see in emails and receipts."
              />

              <form
                onSubmit={handleSaveOrg}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <Input
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="Organization name"
                  className="min-h-12"
                />

                <Button
                  type="submit"
                  disabled={savingOrg}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {savingOrg ? "Saving…" : "Save"}
                </Button>
              </form>
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            id="businesses"
            title="Businesses"
            description="Each business has its own customers and appointments. Edit names or switch CRM mode here."
            collapsedByDefault
            visible={visibleSections.has("businesses")}
          >
            <div className="space-y-4">
              <SettingGroupHeader
                icon={BriefcaseBusiness}
                title="Business workspaces"
                description="Manage the businesses connected to this organization."
                iconClassName="bg-emerald-50 text-emerald-600"
              />

              <ul className="space-y-3">
                {businesses.map((business) => (
                  <li
                    key={business.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    {editingBiz === business.id ? (
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Input
                          value={editBizName}
                          onChange={(event) =>
                            setEditBizName(event.target.value)
                          }
                          placeholder="Business name"
                          className="min-h-12"
                        />

                        <Button
                          size="lg"
                          onClick={() => handleSaveBiz(business.id)}
                        >
                          Save
                        </Button>

                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => setEditingBiz(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {business.name}
                            </p>
                            <p className="mt-1 text-sm capitalize text-slate-500">
                              {business.businessType}
                            </p>
                          </div>

                          {flags.crm_mode_toggle_enabled ? (
                            <Select
                              value={business.crmMode ?? "lite"}
                              onValueChange={(value) =>
                                handleCrmModeChange(
                                  business.id,
                                  value as "lite" | "full",
                                )
                              }
                            >
                              <SelectTrigger className="min-h-11 w-36">
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="lite">CRM Lite</SelectItem>
                                <SelectItem value="full">CRM Full</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingBiz(business.id);
                            setEditBizName(business.name);
                          }}
                          className="w-full sm:w-auto"
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {businesses.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No businesses yet. Create one in Setup.
                </p>
              ) : null}
            </div>
          </SettingsSectionCard>

          {businesses.length > 0 ? (
            <SettingsSectionCard
              id="automation"
              title="Automation Controls"
              description="All automations are free by default. Configure channels, caps-aware messaging, and templates per business."
              collapsedByDefault
              visible={visibleSections.has("automation")}
            >
              <ul className="space-y-5">
                {businesses.map((business) => {
                  const settings =
                    automationSettingsByBiz[business.id] ?? automationDefaults;
                  const saving = automationSavingByBiz[business.id];
                  const draft = inactivityDraftByBiz[business.id];
                  const inactivityValue =
                    draft !== undefined
                      ? draft
                      : String(settings.inactivityDays);

                  return (
                    <li
                      key={business.id}
                      className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                    >
                      <SettingGroupHeader
                        icon={Settings2}
                        title={business.name}
                        description="Configure reminders, channels, and customer follow-up templates."
                        iconClassName="bg-violet-50 text-violet-600"
                      />

                      {saving ? (
                        <p className="text-sm text-slate-500">Saving…</p>
                      ) : null}

                      <div className="space-y-2">
                        <Label className="text-base">
                          Send reminders by SMS or email
                        </Label>

                        <p className="text-sm leading-6 text-slate-600">
                          Choose how customers receive appointment reminders.
                        </p>

                        <Select
                          value={settings.autoSendChannel}
                          disabled={saving}
                          onValueChange={(value) =>
                            updateAutomationSettings(business.id, {
                              autoSendChannel: value as "sms" | "email",
                            })
                          }
                        >
                          <SelectTrigger className="min-h-11 w-full sm:w-44">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-base">
                            Message templates (
                            {settings.autoSendChannel.toUpperCase()})
                          </Label>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Edit what gets sent per automation. Keep placeholders
                            like {"{customerName}"}, {"{dateTime}"},{" "}
                            {"{staffName}"}, and {"{link}"}.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {AUTOMATION_TEMPLATE_KEYS.map((key) => {
                            const channel = settings.autoSendChannel;
                            const current =
                              settings.messageTemplates?.[key]?.[channel] ?? "";

                            return (
                              <div
                                key={key}
                                className="rounded-2xl border border-slate-200 bg-white p-3"
                              >
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                  {key.replaceAll("_", " ")}
                                </p>
                                <Input
                                  value={current}
                                  onChange={(event) => {
                                    const next = {
                                      ...(settings.messageTemplates ?? {}),
                                      [key]: {
                                        ...(settings.messageTemplates?.[key] ??
                                          {}),
                                        [channel]: event.target.value,
                                      },
                                    };

                                    setAutomationSettingsByBiz((previous) => ({
                                      ...previous,
                                      [business.id]: {
                                        ...settings,
                                        messageTemplates: next,
                                      },
                                    }));
                                  }}
                                  onBlur={async (event) => {
                                    const next = mergeMessageTemplateDefaults({
                                      ...(settings.messageTemplates ?? {}),
                                      [key]: {
                                        ...(settings.messageTemplates?.[key] ??
                                          {}),
                                        [channel]: event.currentTarget.value,
                                      },
                                    });

                                    setAutomationSettingsByBiz((previous) => ({
                                      ...previous,
                                      [business.id]: {
                                        ...settings,
                                        messageTemplates: next,
                                      },
                                    }));

                                    setTemplateSaveFeedback({
                                      type: "info",
                                      message: "Saving message template...",
                                    });

                                    try {
                                      await updateAutomationSettings(
                                        business.id,
                                        { messageTemplates: next },
                                        "Message template saved.",
                                        {
                                          suppressFeedback: true,
                                          throwOnError: true,
                                        },
                                      );

                                      setTemplateSaveFeedback({
                                        type: "success",
                                        message: "Message template saved.",
                                      });

                                      setTimeout(
                                        () => setTemplateSaveFeedback(null),
                                        4000,
                                      );
                                    } catch (error) {
                                      setTemplateSaveFeedback({
                                        type: "error",
                                        message: fromError(
                                          error,
                                          "Failed to save message template.",
                                        ),
                                      });
                                    }
                                  }}
                                  placeholder={`Template for ${key.replaceAll(
                                    "_",
                                    " ",
                                  )}`}
                                  className="mt-2"
                                />

                                {planCapabilities.canSeeRefineWithAi ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={saving || !current.trim()}
                                    className="mt-2"
                                    onClick={async () => {
                                      try {
                                        const token = await getToken();
                                        if (!token) return;

                                        const refined = await apiRequest<{
                                          refinedMessage: string;
                                        }>("/automation/refine-message", {
                                          method: "PATCH",
                                          token,
                                          body: JSON.stringify({
                                            businessId: business.id,
                                            automationKey: key,
                                            channel,
                                            draft: current,
                                          }),
                                        });

                                        const next = {
                                          ...(settings.messageTemplates ?? {}),
                                          [key]: {
                                            ...(settings.messageTemplates?.[
                                              key
                                            ] ?? {}),
                                            [channel]: refined.refinedMessage,
                                          },
                                        };

                                        await updateAutomationSettings(
                                          business.id,
                                          {
                                            messageTemplates: next,
                                          },
                                        );
                                      } catch (error) {
                                        setFeedback({
                                          type: "error",
                                          message: fromError(
                                            error,
                                            "Failed to refine template.",
                                          ),
                                        });
                                      }
                                    }}
                                  >
                                    Refine with AI
                                  </Button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Label
                              htmlFor={`${business.id}-appt-reminders`}
                              className="text-base"
                            >
                              Send appointment reminders
                            </Label>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Automatically remind customers 24 hours before
                              their appointment.
                            </p>
                          </div>

                          <Switch
                            id={`${business.id}-appt-reminders`}
                            checked={settings.appointmentRemindersEnabled}
                            disabled={saving}
                            onCheckedChange={(checked) =>
                              updateAutomationSettings(business.id, {
                                appointmentRemindersEnabled: checked,
                              })
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Label
                              htmlFor={`${business.id}-72h-reminder`}
                              className="text-base"
                            >
                              Also send 3-day reminder
                            </Label>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {settings.appointmentRemindersEnabled
                                ? "Sends an extra reminder 3 days before the appointment."
                                : "Turn on appointment reminders above to use this."}
                            </p>
                          </div>

                          <Switch
                            id={`${business.id}-72h-reminder`}
                            checked={settings.appointmentReminder72hEnabled}
                            disabled={
                              saving || !settings.appointmentRemindersEnabled
                            }
                            onCheckedChange={(checked) =>
                              updateAutomationSettings(business.id, {
                                appointmentReminder72hEnabled: checked,
                              })
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Label
                              htmlFor={`${business.id}-inactivity-winback`}
                              className="text-base"
                            >
                              Reach out to inactive customers
                            </Label>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Automatically send a gentle reminder to customers
                              who haven&apos;t visited in a while.
                            </p>
                          </div>

                          <Switch
                            id={`${business.id}-inactivity-winback`}
                            checked={settings.inactivityWinbackEnabled}
                            disabled={saving}
                            onCheckedChange={(checked) =>
                              updateAutomationSettings(business.id, {
                                inactivityWinbackEnabled: checked,
                              })
                            }
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor={`${business.id}-inactivity-days`}
                            className="text-base"
                          >
                            How many days of no visits before outreach?
                          </Label>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Send a gentle reminder after this many days of
                            inactivity (1–365 days). Enter 60 for about 2
                            months.
                          </p>

                          <Input
                            id={`${business.id}-inactivity-days`}
                            type="number"
                            min={1}
                            max={365}
                            value={inactivityValue}
                            disabled={saving}
                            onChange={(event) =>
                              setInactivityDraftByBiz((previous) => ({
                                ...previous,
                                [business.id]: event.target.value,
                              }))
                            }
                            onBlur={(event) => {
                              const value = parseInt(event.target.value, 10);

                              if (
                                !Number.isNaN(value) &&
                                value >= 1 &&
                                value <= 365
                              ) {
                                updateAutomationSettings(business.id, {
                                  inactivityDays: value,
                                });

                                setInactivityDraftByBiz((previous) => {
                                  const next = { ...previous };
                                  delete next[business.id];
                                  return next;
                                });
                              } else {
                                setInactivityDraftByBiz((previous) => ({
                                  ...previous,
                                  [business.id]: String(settings.inactivityDays),
                                }));
                              }
                            }}
                            className="mt-3 w-28"
                          />

                          {draft !== undefined &&
                          (Number.isNaN(parseInt(draft, 10)) ||
                            parseInt(draft, 10) < 1 ||
                            parseInt(draft, 10) > 365) ? (
                            <p className="mt-2 text-sm text-amber-600">
                              Enter a number between 1 and 365.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SettingsSectionCard>
          ) : null}

          {businesses.length > 0 ? (
            <SettingsSectionCard
              id="customer-templates"
              title="Customer Description Templates"
              description="Choose a default template for the description field when adding customers. Templates guide users with simple prompts."
              collapsedByDefault
              visible={visibleSections.has("customer-templates")}
            >
              <div className="space-y-5">
                <SettingGroupHeader
                  icon={FileText}
                  title="Customer description templates"
                  description="Choose the default prompts staff see while adding customers."
                  iconClassName="bg-fuchsia-50 text-fuchsia-600"
                />

                <ul className="space-y-4">
                  {businesses.map((business) => {
                    const data = templatesByBiz[business.id];
                    const templates = data?.templates ?? [];
                    const defaultTemplate = data?.defaultTemplate;
                    const currentValue = defaultTemplate?.id ?? "default";
                    const saving = templateDefaultSavingByBiz[business.id];

                    return (
                      <li
                        key={business.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">
                            {business.name}
                          </p>

                          {saving ? (
                            <span className="text-sm text-slate-500">
                              Saving…
                            </span>
                          ) : null}
                        </div>

                        <Label className="mt-4 block text-base">
                          Default template when adding customers
                        </Label>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          This template will be selected by default in the Add
                          customer form. You can switch to another template when
                          needed.
                        </p>

                        <Select
                          value={currentValue}
                          disabled={saving || templates.length === 0}
                          onValueChange={(value) =>
                            updateDefaultTemplate(business.id, value)
                          }
                        >
                          <SelectTrigger className="mt-3 min-h-11 w-full sm:w-56">
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>

                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem
                                key={template.id}
                                value={template.id}
                              >
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-slate-200 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCreateTemplateOpen(true)}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <PlusCircle className="size-4" />
                    Create custom template
                  </Button>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Create a template with custom prompts such as Source or
                    Preferences. It will appear in the dropdown above.
                  </p>
                </div>
              </div>

              <Dialog
                open={createTemplateOpen}
                onOpenChange={setCreateTemplateOpen}
              >
                <DialogContent className="sm:max-w-md" showCloseButton>
                  <DialogHeader>
                    <DialogTitle>Create description template</DialogTitle>
                    <DialogDescription>
                      Add labeled prompts that appear when adding a customer.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <div>
                      <Label htmlFor="template-name">Template name</Label>
                      <Input
                        id="template-name"
                        value={createTemplateName}
                        onChange={(event) =>
                          setCreateTemplateName(event.target.value)
                        }
                        placeholder="e.g. Salon intake"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="template-business">
                        Which business is this for?
                      </Label>

                      <Select
                        value={createTemplateBusinessId}
                        onValueChange={setCreateTemplateBusinessId}
                      >
                        <SelectTrigger id="template-business" className="mt-2">
                          <SelectValue placeholder="Select business" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="__any__">Any business</SelectItem>

                          {businesses.map((business) => (
                            <SelectItem key={business.id} value={business.id}>
                              {business.name} ({business.businessType || "other"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Fields</Label>

                      <p className="mt-1 text-sm text-slate-500">
                        Each field becomes a labeled input. Label is required.
                      </p>

                      {createTemplateFields.map((field, index) => (
                        <div
                          key={index}
                          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <Input
                            placeholder="Label"
                            value={field.label}
                            onChange={(event) =>
                              setCreateTemplateFields((previous) => {
                                const next = [...previous];
                                next[index] = {
                                  ...next[index],
                                  label: event.target.value,
                                };
                                return next;
                              })
                            }
                          />

                          <Input
                            placeholder="Placeholder (optional)"
                            value={field.placeholder}
                            onChange={(event) =>
                              setCreateTemplateFields((previous) => {
                                const next = [...previous];
                                next[index] = {
                                  ...next[index],
                                  placeholder: event.target.value,
                                };
                                return next;
                              })
                            }
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setCreateTemplateFields((previous) =>
                                previous.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                            disabled={createTemplateFields.length <= 1}
                            aria-label="Remove field"
                          >
                            ×
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() =>
                          setCreateTemplateFields((previous) => [
                            ...previous,
                            { label: "", placeholder: "" },
                          ])
                        }
                      >
                        Add field
                      </Button>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateTemplateOpen(false)}
                      >
                        Cancel
                      </Button>

                      <Button
                        type="submit"
                        disabled={
                          createTemplateSaving || !createTemplateName.trim()
                        }
                      >
                        {createTemplateSaving
                          ? "Creating…"
                          : "Create template"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </SettingsSectionCard>
          ) : null}

          <SettingsSectionCard
            id="messaging"
              title="Messaging usage caps"
            description="Free by default with monthly safety caps."
            collapsedByDefault
            visible={visibleSections.has("messaging")}
          >
            <div className="space-y-5">
              <SettingGroupHeader
                icon={Mail}
                title="Messaging usage"
                description="Track SMS and email usage for the current month."
              />

              <div className="grid gap-5 md:grid-cols-2">
                {smsUsage ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="font-semibold text-slate-950">
                      SMS usage this month
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      {smsUsage.used} / {smsUsage.total} used
                      {smsUsage.total > 0
                        ? ` (${smsUsage.included} included${
                            smsUsage.addon > 0
                              ? ` + ${smsUsage.addon} add-on`
                              : ""
                          })`
                        : ""}
                    </p>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          smsUsage.at100Pct
                            ? "bg-rose-500"
                            : smsUsage.at80Pct
                              ? "bg-amber-500"
                              : "bg-blue-600"
                        }`}
                        style={{
                          width: `${
                            smsUsage.total > 0
                              ? Math.min(
                                  100,
                                  (smsUsage.used / smsUsage.total) * 100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {emailUsage ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="font-semibold text-slate-950">
                      Email usage this month
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      {emailUsage.used} / {emailUsage.total} used (
                      {emailUsage.included} included)
                    </p>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          emailUsage.at100Pct
                            ? "bg-rose-500"
                            : emailUsage.at80Pct
                              ? "bg-amber-500"
                              : "bg-blue-600"
                        }`}
                        style={{
                          width: `${
                            emailUsage.total > 0
                              ? Math.min(
                                  100,
                                  (emailUsage.used / emailUsage.total) * 100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SettingsSectionCard>

          {aiUsage && planCapabilities.canSeeAiUsage ? (
            <SettingsSectionCard
              id="ai-usage"
              title="AI Usage & Quotas"
              description="AI helps you write messages and summaries. Turn it on for better promos and faster workflows."
              collapsedByDefault
              visible={visibleSections.has("ai-usage")}
            >
              <div className="space-y-5">
                <SettingGroupHeader
                  icon={Bot}
                  title="AI usage and policies"
                  description="Review your current limits and decide how AI should behave."
                  iconClassName="bg-violet-50 text-violet-600"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600">
                    <p>
                      Daily AI credits:{" "}
                      {(aiUsage.dailyTokensUsed ?? 0).toLocaleString()} /{" "}
                      {(aiUsage.dailyTokensLimit ?? 0).toLocaleString()}
                    </p>
                    <p>
                      Daily AI messages: {aiUsage.dailyRequestsUsed ?? 0} /{" "}
                      {aiUsage.dailyRequestsLimit ?? 0}
                    </p>
                    <p>
                      Daily reset: {aiUsage.dailyResetDateTime ?? "Not available"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600">
                    <p>
                      Monthly requests: {aiUsage.requestsUsed} /{" "}
                      {aiUsage.requestsLimit}
                    </p>
                    <p>
                      Monthly credits: {aiUsage.tokensUsed.toLocaleString()} /{" "}
                      {aiUsage.tokensLimit.toLocaleString()}
                    </p>
                    <p>Monthly reset: {aiUsage.resetDate}</p>
                  </div>
                </div>

                {aiBreakdown?.items?.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-950">
                      Top features this month
                    </p>

                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {aiBreakdown.items.slice(0, 5).map((item) => (
                        <li key={item.key}>
                          {item.key}: {item.tokens.toLocaleString()} tokens,{" "}
                          {item.requests} requests
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {aiUsage.tokensLimit > 0 ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="ai-enabled" className="text-base">
                        AI enabled
                      </Label>

                      <Switch
                        id="ai-enabled"
                        checked={aiUsage.aiEnabled}
                        disabled={aiPoliciesLoading}
                        onCheckedChange={async (checked) => {
                          setAiPoliciesLoading(true);

                          try {
                            const token = await getToken();
                            if (!token) return;

                            await apiRequest("/ai/usage/policies", {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ aiEnabled: checked }),
                            });

                            setAiUsage((previous) =>
                              previous
                                ? { ...previous, aiEnabled: checked }
                                : null,
                            );

                            setFeedback({
                              type: "success",
                              message: "AI settings updated.",
                            });

                            setTimeout(() => setFeedback(null), 4000);
                          } catch (error) {
                            setFeedback({
                              type: "error",
                              message: fromError(
                                error,
                                "Failed to update AI settings. Please try again.",
                              ),
                            });
                          } finally {
                            setAiPoliciesLoading(false);
                          }
                        }}
                      />
                    </div>

                    <div>
                      <Label htmlFor="soft-cap" className="text-base">
                        Soft cap (50–100%)
                      </Label>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Show a warning when usage reaches this percentage of your
                        limit.
                      </p>

                      <Input
                        id="soft-cap"
                        type="number"
                        min={50}
                        max={100}
                        defaultValue={aiUsage.softCapPct ?? 90}
                        disabled={aiPoliciesLoading}
                        className="mt-3 w-24"
                        onBlur={async (event) => {
                          const value = parseInt(event.target.value, 10);
                          if (Number.isNaN(value) || value < 50 || value > 100) {
                            return;
                          }

                          setAiPoliciesLoading(true);

                          try {
                            const token = await getToken();
                            if (!token) return;

                            await apiRequest("/ai/usage/policies", {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ softCapPct: value }),
                            });

                            setAiUsage((previous) =>
                              previous
                                ? { ...previous, softCapPct: value }
                                : null,
                            );
                          } catch (error) {
                            setFeedback({
                              type: "error",
                              message: fromError(
                                error,
                                "Failed to update soft cap. Please try again.",
                              ),
                            });
                          } finally {
                            setAiPoliciesLoading(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </SettingsSectionCard>
          ) : null}

          {isDevMode ? (
            <SettingsSectionCard
              id="dev-tools"
              title="Dev Tools"
              description="API overrides and debug helpers. Development only."
              collapsedByDefault
              visible={visibleSections.has("dev-tools")}
            >
              <div className="space-y-5">
                <SettingGroupHeader
                  icon={Wrench}
                  title="Development tools"
                  description="Use temporary API overrides and local debugging helpers."
                  iconClassName="bg-slate-100 text-slate-600"
                />

                <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      API base URL override
                    </p>

                    <Input
                      value={devApiUrl}
                      onChange={(event) =>
                        setDevApiUrlState(event.target.value)
                      }
                      onBlur={() => setDevApiUrl(devApiUrl)}
                      placeholder={
                        process.env.NEXT_PUBLIC_API_URL ||
                        "http://localhost:3001"
                      }
                      className="mt-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Mock latency (ms)
                    </p>

                    <Input
                      type="number"
                      min={0}
                      value={devMockLatencyMs}
                      onChange={(event) => {
                        const value = parseInt(event.target.value, 10) || 0;
                        setDevMockLatencyMsState(value);
                        setDevMockLatencyMs(value);
                      }}
                      className="mt-2 w-28"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Mock API failure
                    </p>

                    <Button
                      size="sm"
                      variant={devMockFailure ? "destructive" : "outline"}
                      className="mt-2"
                      onClick={() => {
                        setDevMockFailure(!devMockFailure);
                        setDevMockFailureState(!devMockFailure);
                      }}
                    >
                      {devMockFailure ? "On" : "Off"}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Auth / session inspector
                    </p>

                    <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-500">
                      {syncData ? (
                        <>
                          <p>
                            Org: {syncData.organization?.id ?? "-"} (
                            {syncData.organization?.name ?? "-"})
                          </p>
                          <p>User: {syncData.user?.id ?? "-"}</p>
                        </>
                      ) : (
                        <p>Loading sync data...</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Cache reset
                    </p>

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        clearDevOverrides();
                        setDevApiUrlState("");
                        setDevMockLatencyMsState(0);
                        setDevMockFailureState(false);
                        window.location.reload();
                      }}
                    >
                      Clear dev overrides and reload
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsSectionCard>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <SettingsPageContent />
    </Suspense>
  );
}
