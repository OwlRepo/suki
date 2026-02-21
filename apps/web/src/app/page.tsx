import Link from "next/link";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { Button } from "@/components/ui/button";

const PAIN_SOLUTIONS = [
  {
    pain: "Data is messy and duplicates break reporting.",
    solution: "Built-in dedupe checks, cleaner import validation, structured customer profiles.",
    outcome: "More reliable segments and campaign targeting.",
  },
  {
    pain: "Teams avoid CRM because updates are manual and slow.",
    solution: "Simplified workflows, workspace persistence, and automation-ready actions.",
    outcome: "Higher team adoption with less admin burden.",
  },
  {
    pain: "Insights are fragmented across tools and tabs.",
    solution: "Unified dashboard and CRM modules under one business workspace context.",
    outcome: "Faster decisions from one source of truth.",
  },
  {
    pain: "Switching CRMs feels risky and disruptive.",
    solution: "Guided migration with mapping, validation, and dry-run.",
    outcome: "Safer rollout with fewer go-live surprises.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Capture customers",
    description:
      "QR intake, manual entry, or import from spreadsheets. No required fields—collect only what customers share.",
  },
  {
    step: "2",
    title: "Track repeat behavior",
    description:
      "See new vs repeat customers every month. Last visit and visit count per customer. Plain-language insights.",
  },
  {
    step: "3",
    title: "Take one-tap actions",
    description:
      "Send promos or reminders in under a minute. AI writes the message; you choose the offer and audience.",
  },
] as const;

const BEFORE_AFTER = {
  before: [
    "Paper logbooks and memory",
    "No follow-ups or forgotten reminders",
    "Unclear who comes back",
    "Guesswork on improvement",
  ],
  after: [
    "Organized customer list",
    "Follow-ups at the right time",
    "Clear new vs repeat metrics",
    "Proof if things are improving",
  ],
} as const;

const SUKI_VS_CRM = [
  { aspect: "Setup", suki: "Guided questions, ready in minutes", other: "Complex configuration" },
  { aspect: "Daily use", suki: "Tap-based, under a minute", other: "Dashboards and training" },
  { aspect: "AI", suki: "Assists only; you stay in control", other: "Black-box automation" },
  { aspect: "Pricing", suki: "Predictable, no surprise charges", other: "Usage-based or enterprise" },
  { aspect: "Growth", suki: "Add modules when ready", other: "All-in or nothing" },
] as const;

const PLANS = [
  {
    name: "Basic",
    price: "₱499",
    period: "/month",
    forWhom: "Organize customers first",
    features: ["Customer list, QR intake, manual entry", "Last visit and visit count", "New customers this month", "CSV and data migration"],
    cta: "Start with Basic",
  },
  {
    name: "Grow",
    price: "₱999",
    period: "/month",
    forWhom: "Bring customers back",
    features: ["Everything in Basic", "One focused module (Promos or Appointments)", "New vs repeat customers monthly", "AI-assisted message writing"],
    cta: "Start with Grow",
  },
  {
    name: "Pro",
    price: "₱1,499",
    period: "/month",
    forWhom: "Run a busier business",
    features: ["Everything in Grow", "Two modules at once", "Month-to-month comparison", "Higher AI allowance"],
    cta: "Start with Pro",
  },
] as const;

const FAQ = [
  {
    q: "Can we switch from Lite to Full without losing data?",
    a: "Yes. Your records stay compatible across both modes—no data reset, no forced re-import.",
  },
  {
    q: "Which CRMs can we migrate from first?",
    a: "Guided migration supports Salesforce, HubSpot, Dynamics, Zoho, and Pipedrive—with mapping, validation, and dry-run.",
  },
  {
    q: "Do you support on-prem and offline environments?",
    a: "Yes. Self-hosted deployment with signed licensing and offline/air-gapped paths is available for regulated clients.",
  },
  {
    q: "How is business/workspace access controlled per user?",
    a: "Each user has a per-user, server-persisted active workspace. One workspace picker applies across all pages.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-semibold text-foreground">Suki</span>
          <AuthCta />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            CRM for growing service businesses
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Fix CRM chaos without adding complexity
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            One workspace across pages, cleaner customer records, and a Lite-to-Full
            path that scales with your business.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-left text-sm text-muted-foreground sm:text-base max-w-md mx-auto">
            <li>• Reduce repetitive manual updates</li>
            <li>• Keep customer and visit history accurate</li>
            <li>• Upgrade to Full CRM without data rework</li>
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <LandingCta />
            <Button variant="outline" asChild>
              <Link href="/sign-up">Book Full CRM Demo</Link>
            </Button>
            <Link href="#migration" className="text-sm text-muted-foreground hover:text-foreground">
              Migrating from another CRM?
            </Link>
          </div>
        </section>

        {/* Problem to value */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Most CRMs fail at adoption, data quality, and workflow speed
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Suki is built to solve those first—one workspace across pages, cleaner
            records, and automation that reduces repetitive admin work
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PAIN_SOLUTIONS.map(({ pain, solution, outcome }) => (
              <div
                key={pain}
                className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <p className="font-medium text-foreground">Pain: {pain}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Suki fix: {solution}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Outcome: {outcome}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Fits into daily operations—no behavior change required
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col">
                <span className="text-4xl font-bold text-muted-foreground/50">
                  {step}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Lite to Full path */}
        <section className="mt-20 sm:mt-28" id="lite-full">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Start with Lite. Switch to Full when operations get complex
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Your records stay compatible across both modes—no data reset, no forced
            re-import. Full mode toggle available on Growth and AI Pro plans.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">CRM Lite</h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Core customer management</li>
                <li>Simple campaign and loyalty workflows</li>
              </ul>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
              <h3 className="font-semibold text-foreground">CRM Full</h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-foreground">
                <li>Advanced pipeline and workflow automation</li>
                <li>Expanded analytics and operations controls</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Button asChild>
              <Link href="#pricing">See Plans</Link>
            </Button>
          </div>
        </section>

        {/* Migration trust */}
        <section className="mt-20 sm:mt-28" id="migration">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Moving from Salesforce, HubSpot, Dynamics, Zoho, or Pipedrive?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Import with confidence using validation and dry-run before final cutover
          </p>
          <div className="mx-auto mt-10 max-w-2xl grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Field mapping templates</li>
                <li>• Duplicate/conflict preview</li>
                <li>• Dry-run import report</li>
                <li>• Post-import reconciliation</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">How it works</p>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>1. Connect source</li>
                <li>2. Map and validate</li>
                <li>3. Dry-run</li>
                <li>4. Go live with reconciliation report</li>
              </ol>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Button variant="outline" asChild>
              <Link href="/sign-up">Plan My Migration</Link>
            </Button>
          </div>
        </section>

        {/* On-prem trust */}
        <section className="mt-20 sm:mt-28" id="onprem">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Need self-hosted deployment on your local network?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Ideal for organizations with strict compliance or internal IT governance needs
          </p>
          <ul className="mx-auto mt-10 max-w-xl list-inside list-disc space-y-2 text-muted-foreground">
            <li>Signed licensing with entitlement controls</li>
            <li>Signed update packages with rollback support</li>
            <li>Offline/air-gapped deployment path available</li>
            <li>Administrative audit trail for activation and updates</li>
          </ul>
          <div className="mt-6 text-center">
            <Button variant="outline" asChild>
              <Link href="/sign-up">Talk to Sales for On-Prem</Link>
            </Button>
          </div>
        </section>

        {/* AI that stays in control */}
        <section className="mt-20 sm:mt-28">
          <div className="rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              AI that assists—you stay in control
            </h2>
            <p className="mt-4 text-muted-foreground">
              AI writes messages and summaries only. It does not decide
              pricing, business logic, or run automatically. Fixed credits,
              hard caps, no surprise charges. When allowance runs out, AI
              pauses; the core app keeps working.
            </p>
          </div>
        </section>

        {/* Before vs After */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Before and after
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold text-muted-foreground">Before</h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-card-foreground">
                {BEFORE_AFTER.before.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 shadow-sm">
              <h3 className="font-semibold text-foreground">After Suki</h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-foreground">
                {BEFORE_AFTER.after.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Suki vs generic CRM */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Suki vs generic CRM
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Built for real workflows, not dashboards
          </p>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse rounded-lg border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-medium text-foreground">
                    Aspect
                  </th>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-medium text-foreground">
                    Suki
                  </th>
                  <th className="border-b border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Typical CRM
                  </th>
                </tr>
              </thead>
              <tbody>
                {SUKI_VS_CRM.map(({ aspect, suki, other }) => (
                  <tr key={aspect} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {aspect}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{suki}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {other}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pricing */}
        <section className="mt-20 sm:mt-28" id="pricing">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Plans that grow with your business
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Start simple. Upgrade only when needed. No surprise charges.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-card-foreground">
                  {plan.name}
                </h3>
                <p className="mt-2 text-muted-foreground">{plan.forWhom}</p>
                <p className="mt-4 text-2xl font-bold text-foreground">
                  {plan.price}
                  <span className="text-base font-normal text-muted-foreground">
                    {plan.period}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button asChild className="mt-6">
                  <Link href="/sign-up">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Trust & FAQ */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Your data is safe
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Your business owns the data. Nothing is deleted if you stop. View and
            export anytime. Works on any device.
          </p>
          <div className="mx-auto mt-10 max-w-2xl space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="font-medium text-foreground">{q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-20 sm:mt-28 flex flex-col items-center gap-6 rounded-xl border border-border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Choose the path that fits your stage today
          </h2>
          <p className="max-w-lg text-muted-foreground">
            No replatforming when you scale from Lite to Full.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LandingCta />
            <Button variant="outline" asChild>
              <Link href="/sign-up">Book Full CRM Strategy Call</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mt-20 border-t border-border py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          Suki — Customer engagement for Philippine small business.
        </div>
      </footer>
    </div>
  );
}
