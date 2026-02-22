import Link from "next/link";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";

const PROBLEM_POINTS = [
  "Customers forget appointments—empty slots, lost revenue",
  "Staff forgets to follow up—you lose customers silently",
  "Inconsistent reminders—some get texts, some don't",
  "Churn you never see coming—until they're already gone",
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Capture customers once",
    description:
      "QR signup link, manual entry, or import. One record per customer. No spreadsheets.",
  },
  {
    step: "2",
    title: "Track visits automatically",
    description:
      "Stamp visits as they happen. Suki knows who came, when, and who hasn't been back.",
  },
  {
    step: "3",
    title: "Reminders and follow-ups run on their own",
    description:
      "Set it once. Suki sends reminders, thank-yous, and winback messages at the right time—without you remembering.",
  },
] as const;

const KEY_AUTOMATIONS = [
  {
    name: "Appointment reminders",
    benefit: "Fewer no-shows, more filled slots",
  },
  {
    name: "Missed appointment recovery",
    benefit: "Second chance for customers who didn't show",
  },
  {
    name: "Post-visit follow-ups",
    benefit: "Thank-you and rebook while the experience is fresh",
  },
  {
    name: "Inactivity winback",
    benefit: "We miss you—bring back customers before they churn for good",
  },
] as const;

const BEFORE_AFTER = {
  before: [
    "Paper logbooks and memory",
    "No follow-ups or forgotten reminders",
    "Unclear who comes back",
    "Customers drift away—you never notice",
  ],
  after: [
    "Organized customer list",
    "Follow-ups at the right time, automatically",
    "Clear new vs repeat, who's drifting",
    "Revenue recovered from customers you'd have lost",
  ],
} as const;

const PLANS = [
  {
    name: "Basic",
    price: "₱499",
    period: "/month",
    forWhom: "Organize customers first",
    features: ["Customer list, QR signup link, manual entry", "Last visit and visit count", "New customers this month"],
    cta: "Start with Basic",
  },
  {
    name: "Grow",
    price: "₱999",
    period: "/month",
    forWhom: "Bring customers back",
    features: ["Everything in Basic", "Promos or Appointments module", "New vs repeat customers monthly", "AI-assisted message writing"],
    cta: "Start with Grow",
  },
  {
    name: "Pro",
    price: "₱1,499",
    period: "/month",
    forWhom: "Run a busier business",
    features: ["Everything in Grow", "Two modules at once", "Month-to-month comparison"],
    cta: "Start with Pro",
  },
] as const;

const FAQ = [
  {
    q: "What happens to my data if I stop?",
    a: "Your business owns the data. Nothing is deleted. View and export anytime.",
  },
  {
    q: "Can I use this on my phone?",
    a: "Yes. Suki works on any device—phone, tablet, or computer.",
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
        {/* Hero — outcome-focused, no CRM above fold */}
        <section className="flex flex-col items-center gap-6 py-6 sm:py-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl max-w-2xl">
            Fewer no-shows. Customers coming back.
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground leading-relaxed">
            Suki sends appointment reminders and follow-ups automatically—so you don&apos;t have to remember. Less manual texting, less mental load.
          </p>
          <div className="flex flex-col items-center gap-4 pt-2">
            <PrimaryPageAction className="w-full max-w-sm sm:max-w-xs [&>div]:justify-center">
              <LandingCta singlePrimary />
            </PrimaryPageAction>
            <Button variant="outline" size="lg" className="min-h-[44px]" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </section>

        {/* Problem — owner pain */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl max-w-2xl mx-auto">
            Sound familiar?
          </h2>
          <p className="mx-auto max-w-xl text-center text-muted-foreground leading-relaxed">
            Customers forget. Staff forgets. Owners lose revenue and never see it coming.
          </p>
          <ul className="mx-auto pt-6 max-w-xl list-inside list-disc space-y-2 text-muted-foreground">
            {PROBLEM_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        {/* Solution — replaces memory, set once runs automatically */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl max-w-2xl mx-auto">
            Suki replaces memory and manual work
          </h2>
          <p className="mx-auto max-w-xl text-center text-muted-foreground leading-relaxed">
            Capture customers once. Track visits. Set your reminders and follow-ups—then let Suki run them automatically. No spreadsheets. No forgotten texts.
          </p>
          <div className="mx-auto pt-6 max-w-md rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="font-semibold text-foreground">Set once. Runs automatically.</p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Simple steps. Each one ties to relief or recovered revenue.
          </p>
          <div className="pt-6 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <Card key={step} className="flex flex-col rounded-lg p-5">
                <CardContent className="flex flex-col p-0">
                  <span className="text-4xl font-bold text-muted-foreground/50" aria-hidden>
                    {step}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Key automations */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            What runs automatically
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            These automations run on their own—you don&apos;t lift a finger.
          </p>
          <div className="pt-6 grid gap-4 sm:grid-cols-2">
            {KEY_AUTOMATIONS.map(({ name, benefit }) => (
              <Card key={name} className="flex flex-col rounded-lg p-5 shadow-sm">
                <CardContent className="flex flex-col p-0">
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{benefit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Before and after */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Before and after
          </h2>
          <div className="pt-6 grid gap-6 sm:grid-cols-2">
            <Card className="rounded-lg p-5 shadow-sm">
              <CardContent className="p-0">
                <h3 className="font-semibold text-muted-foreground">Before</h3>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-card-foreground">
                  {BEFORE_AFTER.before.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="rounded-lg border-primary/30 bg-primary/5 p-5 shadow-sm">
              <CardContent className="p-0">
                <h3 className="font-semibold text-foreground">After Suki</h3>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-foreground">
                  {BEFORE_AFTER.after.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing */}
        <section className="mt-16 sm:mt-24 space-y-6" id="pricing">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Plans that grow with your business
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            One recovered customer per month typically covers the cost. A single missed appointment at ₱500+ is revenue you can get back.
          </p>
          <div className="pt-6 grid gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className="flex flex-col rounded-xl p-6 shadow-sm"
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
                <Button asChild size="lg" className="mt-6 min-h-[44px]">
                  <Link href="/sign-up">{plan.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Who it is for / not for */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Who Suki is for—and who it&apos;s not
          </h2>
          <div className="pt-6 grid gap-6 sm:grid-cols-2">
            <Card className="rounded-lg border-primary/30 bg-primary/5 p-5">
              <CardContent className="p-0">
                <h3 className="font-semibold text-foreground">For you</h3>
                <p className="mt-2 text-sm text-foreground">
                  Philippine service businesses with appointments or repeat visits: salons, barbershops, clinics, dental clinics, gyms, spas.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg p-5">
              <CardContent className="p-0">
                <h3 className="font-semibold text-muted-foreground">Not a fit</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cafes, convenience stores, high-volume transactional retail. Suki is built for businesses where customers book ahead or come back regularly.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Trust & FAQ */}
        <section className="mt-16 sm:mt-24 space-y-6">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Your data is safe
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Your business owns the data. Nothing is deleted if you stop. View and export anytime.
          </p>
          <div className="mx-auto pt-6 max-w-2xl space-y-4">
            {FAQ.map(({ q, a }) => (
              <Card key={q} className="rounded-lg border-border bg-muted/20 p-4">
                <CardContent className="p-0">
                  <p className="font-medium text-foreground">{q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 sm:mt-24 flex flex-col items-center gap-6 rounded-xl border border-border bg-muted/30 p-8 sm:p-10 text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl max-w-xl">
            Start bringing customers back—without the busywork
          </h2>
          <p className="max-w-lg text-muted-foreground leading-relaxed">
            Try free. Set up in minutes. No credit card required.
          </p>
          <PrimaryPageAction className="justify-center">
            <LandingCta singlePrimary />
          </PrimaryPageAction>
          <Button variant="outline" size="lg" className="min-h-[44px]" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </section>
      </main>

      <footer className="mt-16 sm:mt-24 border-t border-border py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          Suki — Customer engagement for Philippine small business.
        </div>
      </footer>
    </div>
  );
}
