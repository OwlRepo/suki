import Link from "next/link";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { Button } from "@/components/ui/button";

const PAIN_SOLUTIONS = [
  {
    pain: "Customers don't come back",
    solution: "Follow-ups and targeted promotions",
  },
  {
    pain: "Customer info on paper or scattered",
    solution: "Simple customer list and QR intake",
  },
  {
    pain: "No-shows and forgotten reminders",
    solution: "Appointment reminders and tracking",
  },
  {
    pain: "Idle hours and lost capacity",
    solution: "Promotions for slow periods",
  },
  {
    pain: "Owners lack visibility",
    solution: "Monthly insights and activity dashboard",
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
    q: "Is this complicated to use?",
    a: "No. It's designed for daily use—tap-based, mobile-first. Staff use it without training.",
  },
  {
    q: "Can we change plans later?",
    a: "Yes, anytime. Upgrade when you need more. No long-term lock-in.",
  },
  {
    q: "Does it work on phones?",
    a: "Yes. Works on phone, tablet, or computer.",
  },
  {
    q: "What happens to our data if we stop?",
    a: "Your data stays yours. Nothing is deleted. You can view and export it.",
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
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Grow repeat visits without adding complexity
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Simple CRM for Philippine small businesses. Organize customers, send
            follow-ups, and see who comes back—with AI that assists, never
            decides for you.
          </p>
          <LandingCta />
        </section>

        {/* Problem to value */}
        <section className="mt-20 sm:mt-28">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Common problems, practical solutions
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            For salons, cafes, spas, carwash, and similar businesses
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PAIN_SOLUTIONS.map(({ pain, solution }) => (
              <div
                key={pain}
                className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <p className="font-medium text-foreground">{pain}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  → {solution}
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
        <section className="mt-20 sm:mt-28">
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
            Ready to grow repeat visits?
          </h2>
          <p className="max-w-lg text-muted-foreground">
            Short setup with simple questions. Migrate existing data. See
            insights immediately. Start small, grow when ready.
          </p>
          <LandingCta />
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
