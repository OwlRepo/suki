import Link from "next/link";
import { HeroIllustration } from "@/components/landing/hero-illustration";
import { WorkflowIllustration } from "@/components/landing/workflow-illustration";
import { SuccessIllustration } from "@/components/landing/success-illustration";
import {
  BarChart3,
  CalendarCheck,
  MessageSquare,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";

const TRUST_CHIPS = [
  "No credit card to start",
  "Set up in minutes",
  "You don't need to open it every day—it just runs",
  "Works on any device",
] as const;

const OUTCOME_STATS = [
  {
    label: "Fewer no-shows",
    value: "Fewer empty slots when customers get reminded",
    source: "Simple reminders, sent on time.",
  },
  {
    label: "Recovered revenue",
    value:
      "Recover revenue you'd lose from forgotten follow-ups—one saved appointment often covers a month's plan",
    source: "Example based on typical service pricing.",
  },
  {
    label: "Less manual work",
    value:
      "Set once—follow-ups run automatically so customers come back without you remembering",
    source: "Fully automated after initial setup.",
  },
] as const;

const PROBLEM_POINTS = [
  "Customers forget appointments—empty slots, lost revenue",
  "Staff forgets to follow up—you lose customers silently",
  "Inconsistent reminders—some get texts, some don't",
  "They leave and you never notice—until they're already gone",
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: Users,
    title: "Capture customers once",
    description:
      "QR signup link, manual entry, or import. One record per customer. No spreadsheets.",
  },
  {
    step: "2",
    icon: CalendarCheck,
    title: "Track visits automatically",
    description:
      "Mark visits as they happen. Suki knows who came, when, and who hasn't been back.",
  },
  {
    step: "3",
    icon: MessageSquare,
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
    benefit:
      "Thank-you and rebook while it's fresh—no money lost to forgotten follow-ups",
  },
  {
    name: "Inactivity winback",
    benefit:
      "Bring back customers automatically before they're gone for good—recover revenue you'd have lost",
  },
] as const;

const BEFORE_AFTER = {
  before: [
    "Paper logbooks and memory",
    "Forgotten follow-ups—and money slipping away",
    "Unclear who comes back",
    "Customers drift away—you never notice",
  ],
  after: [
    "Organized customer list",
    "Follow-ups at the right time, automatically",
    "Clear who's coming back and who isn't",
    "Revenue recovered from customers you'd have lost",
  ],
} as const;

const PLANS = [
  {
    name: "Basic",
    price: "₱499",
    period: "/month",
    forWhom: "Organize customers first",
    features: [
      "Customer list, QR signup link, manual entry",
      "Last visit and visit count",
      "New customers this month",
    ],
    cta: "Start with Basic",
  },
  {
    name: "Grow",
    price: "₱999",
    period: "/month",
    forWhom: "Bring customers back",
    features: [
      "Everything in Basic",
      "Promos or Appointments module",
      "New vs repeat customers monthly",
      "Helpful message suggestions",
    ],
    cta: "Start with Grow",
  },
  {
    name: "Pro",
    price: "₱1,499",
    period: "/month",
    forWhom: "Run a busier business",
    features: [
      "Everything in Grow",
      "Two modules at once",
      "Month-to-month comparison",
    ],
    cta: "Start with Pro",
  },
] as const;

const FAQ = [
  {
    q: "What happens to my data if I stop?",
    a: "Your business owns the data. Nothing is deleted. View and export anytime.",
  },
  {
    q: "Do I need to use it every day?",
    a: "No. Set it up once. Messages send themselves. You don't need to open it every day.",
  },
  {
    q: "Can I use this on my phone?",
    a: "Yes. Suki works on any device—phone, tablet, or computer.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses are up and running in under 10 minutes. Scan a QR, add a few customers, and messages send themselves. No long forms. No tutorials.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Month-to-month billing. Cancel when you need. Your data stays yours.",
  },
  {
    q: "What about message volume and costs?",
    a: "SMS costs vary by carrier and region. Suki sends only the messages you configure—no surprises.",
  },
  {
    q: "Where do the outcome numbers come from?",
    a: "Based on typical service businesses. Results vary by business type and how you use reminders.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-semibold text-foreground">
            Suki
          </Link>
          <AuthCta />
        </div>
      </header>

      <main>
        {/* Hero — split layout with visual */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                {TRUST_CHIPS.map((chip) => (
                  <Badge
                    key={chip}
                    variant="secondary"
                    className="text-xs font-medium"
                  >
                    {chip}
                  </Badge>
                ))}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Fewer no-shows. Customers coming back.
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground leading-relaxed">
                Suki sends appointment reminders and follow-ups automatically—so
                you stop losing money from forgotten follow-ups. Less manual
                texting, less mental load. Built for service businesses worldwide.
              </p>
              <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                <PrimaryPageAction className="w-full sm:w-auto [&>div]:justify-start">
                  <LandingCta singlePrimary />
                </PrimaryPageAction>
                <Button variant="outline" size="lg" className="min-h-[44px]" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="relative mt-12 lg:mt-0 flex items-center justify-center">
              <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 shadow-lg lg:max-w-lg">
                <HeroIllustration className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>

        {/* Trusted outcomes band */}
        <section className="border-y border-border bg-muted/20 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="sr-only">Trusted outcomes</h2>
            <div className="grid gap-8 sm:grid-cols-3 sm:items-stretch">
              {OUTCOME_STATS.map(({ label, value, source }) => (
                <div key={label} className="flex min-h-full flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-5 shrink-0 text-primary" />
                    <span className="font-semibold text-foreground">{label}</span>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground/80">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem — owner pain */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Sound familiar?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground leading-relaxed">
            Customers forget. Staff forgets to follow up. You lose money from
            forgotten follow-ups—and often never see it coming. One missed
            follow-up or no-show is often ₱500–₱1,000 gone.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Most businesses lose customers not because they&apos;re bad, but
            because everyone forgets. Suki just makes sure no one forgets.
          </p>
          <ul className="mx-auto mt-8 max-w-xl list-inside list-disc space-y-2 text-muted-foreground">
            {PROBLEM_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        {/* Solution — replaces memory */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Suki replaces memory and manual work
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Capture customers once. Track visits. Set your reminders and
                follow-ups—then let Suki run them automatically. Customers come
                back without you remembering. No spreadsheets. No forgotten texts.
              </p>
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Zap className="size-5 text-primary" />
                  Set once. Runs automatically.
                </p>
              </div>
              <p className="mt-4 text-muted-foreground italic">
                Think of it as a staff member whose only job is to remember
                customers and send messages at the right time—so customers come
                back automatically and you stop losing money from forgotten
                follow-ups.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-6">
              <WorkflowIllustration className="h-auto w-full" />
            </div>
          </div>
        </section>

        {/* One concrete scenario */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="rounded-xl border border-border bg-muted/20 p-6 text-center sm:p-8">
            <p className="text-sm font-medium text-muted-foreground">
              How it works in one example
            </p>
            <p className="mt-2 text-foreground leading-relaxed">
              Customer visits today. Suki remembers. A few days later, it sends
              a friendly follow-up—so you never forget. Customer comes back
              automatically. No money lost to forgotten follow-ups.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Simple steps. Each one ties to relief or recovered revenue.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
              <Card key={step} className="flex flex-col overflow-hidden">
                <CardContent className="flex flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      Step {step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
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
        <section className="border-t border-border bg-muted/10 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
              What runs automatically
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              Reminders and follow-ups send on their own—you don&apos;t lift a
              finger.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {KEY_AUTOMATIONS.map(({ name, benefit }) => (
                <Card key={name} className="flex flex-col p-6 shadow-sm">
                  <CardContent className="flex flex-col p-0">
                    <p className="font-semibold text-foreground">{name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {benefit}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Before and after */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Before and after
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Card className="rounded-xl p-6 shadow-sm">
              <CardContent className="p-0">
                <h3 className="font-semibold text-muted-foreground">Before</h3>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-card-foreground">
                  {BEFORE_AFTER.before.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-primary/30 bg-primary/5 p-6 shadow-sm">
              <CardContent className="p-0">
                <h3 className="font-semibold text-foreground">After Suki</h3>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-foreground">
                  {BEFORE_AFTER.after.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Who it's for (positive ICP framing) */}
        <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
              Built for service businesses
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
              Service businesses with appointments or repeat visits: salons,
              barbershops, clinics, dental clinics, gyms, spas. If customers book
              ahead or come back regularly, Suki fits.
            </p>
            <div className="mt-8 flex justify-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {["Salons", "Clinics", "Gyms", "Spas", "Barbershops"].map(
                  (biz) => (
                    <Badge key={biz} variant="outline" className="text-sm">
                      {biz}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
          id="pricing"
        >
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Plans that grow with your business
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            If one customer comes back because of this, it already paid for
            itself. A single missed appointment (e.g. ₱800+) is revenue you can
            get back. Pricing in PHP—local currency support coming for more
            regions.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
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

        {/* Trust & FAQ */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2">
              <Shield className="size-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Your data is safe
              </h2>
            </div>
            <p className="mt-2 text-muted-foreground">
              Your business owns the data. Nothing is deleted if you stop. View
              and export anytime.
            </p>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map(({ q, a }, i) => (
                <AccordionItem key={q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent>{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA with image */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
                <h2 className="text-2xl font-semibold text-foreground sm:text-3xl max-w-xl">
                  Start bringing customers back automatically—and stop losing
                  money from forgotten follow-ups
                </h2>
                <p className="max-w-lg text-muted-foreground leading-relaxed">
                  Try free. Set up in minutes. No credit card required.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <PrimaryPageAction className="justify-center lg:justify-start">
                    <LandingCta singlePrimary />
                  </PrimaryPageAction>
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-[44px]"
                    asChild
                  >
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 shadow-lg">
                <SuccessIllustration className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          Suki — Customer engagement for small service businesses.
        </div>
      </footer>
    </div>
  );
}
