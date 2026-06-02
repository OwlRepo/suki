import Link from "next/link";
import { HeroIllustration } from "@/components/landing/hero-illustration";
import { WorkflowIllustration } from "@/components/landing/workflow-illustration";
import { SuccessIllustration } from "@/components/landing/success-illustration";
import {
  BarChart3,
  CalendarCheck,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { TyveraMark } from "./sign-in/page";

const TRUST_CHIPS = [
  "All core features available",
  "No payment setup required",
  "Built for repeat-visit businesses",
  "Fast setup for small teams",
] as const;

const OUTCOME_STATS = [
  {
    label: "Fewer no-shows",
    value: "Customers get reminded before their appointment.",
    source: "Automated confirmation + reminder messages.",
  },
  {
    label: "Recovered bookings",
    value:
      "Recovered bookings help keep your calendar full and revenue steady.",
    source:
      "Built for salons, clinics, gyms, spas, and repeat-visit businesses.",
  },
  {
    label: "Clear daily limits",
    value: "Built-in usage limits help prevent accidental abuse.",
    source: "Daily caps for AI and follow-up sending.",
  },
] as const;

const PROBLEM_POINTS = [
  "Customers forget appointments, causing empty slots.",
  "Staff forgets follow-ups, so customers quietly disappear.",
  "Manual texting takes time and becomes inconsistent.",
  "Owners only notice lost customers when revenue is already down.",
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: Users,
    title: "Capture customers once",
    description:
      "Use QR signup, manual entry, or imports. Tyvera keeps one organized customer record with visit history.",
  },
  {
    step: "2",
    icon: CalendarCheck,
    title: "Track visits and appointments",
    description:
      "Tyvera knows who booked, who visited, who missed, and who has not returned in a while.",
  },
  {
    step: "3",
    icon: MessageSquare,
    title: "Automations send the right message",
    description:
      "Reminders, thank-yous, missed appointment recovery, and winback messages run automatically.",
  },
] as const;

const KEY_AUTOMATIONS = [
  {
    name: "Appointment reminders",
    benefit: "Confirmation and 24-hour reminders reduce forgotten bookings.",
  },
  {
    name: "Missed appointment recovery",
    benefit: "Send a rebook message after a missed appointment.",
  },
  {
    name: "Post-visit follow-ups",
    benefit:
      "Thank customers and invite them to book again while the visit is fresh.",
  },
  {
    name: "Inactivity winback",
    benefit:
      "Automatically message customers who have not returned after 60+ days.",
  },
] as const;

const BEFORE_AFTER = {
  before: [
    "Manual texts",
    "Spreadsheets and notebooks",
    "Forgotten follow-ups",
    "No clear customer return tracking",
  ],
  after: [
    "Automated reminders",
    "Organized customer records",
    "Winback messages run automatically",
    "Clear visibility into repeat customers",
  ],
} as const;

const FAQ = [
  {
    q: "Is Tyvera free to use?",
    a: "Yes. Tyvera is currently in free mode with all core features enabled.",
  },
  {
    q: "How do usage limits work?",
    a: "Tyvera enforces daily limits for AI and follow-up sending to prevent abuse and keep usage healthy.",
  },
  {
    q: "Is Tyvera only for the Philippines?",
    a: "Tyvera is designed first for Philippine service businesses, especially salons, clinics, gyms, spas, and appointment-based businesses.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950"
          >
            <TyveraMark />
            Tyvera
          </Link>
          <AuthCta />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                {TRUST_CHIPS.map((chip) => (
                  <Badge key={chip} variant="secondary">
                    {chip}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Recover lost customers automatically.
              </h1>

              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                Tyvera helps Philippine service businesses reduce no-shows, send
                follow-ups, and bring customers back automatically.
              </p>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                <p className="font-semibold text-foreground">
                  Free mode is active with core features enabled and sensible
                  daily limits to prevent abuse.
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                <PrimaryPageAction className="w-full sm:w-auto [&>div]:justify-start">
                  <LandingCta singlePrimary />
                </PrimaryPageAction>
              </div>
            </div>

            <div className="relative mt-12 flex items-center justify-center lg:mt-0">
              <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 shadow-lg lg:max-w-lg">
                <HeroIllustration className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/20 py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
            {OUTCOME_STATS.map(({ label, value, source }) => (
              <div key={label} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" />
                  <span className="font-semibold text-foreground">{label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{value}</p>
                <p className="text-xs text-muted-foreground/80">{source}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            The problem is not bad service. It is forgotten follow-up.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center leading-relaxed text-muted-foreground">
            Customers forget appointments. Staff get busy. Follow-ups are
            missed. Tyvera makes sure the right message still gets sent.
          </p>

          <ul className="mx-auto mt-8 max-w-xl list-inside list-disc space-y-2 text-muted-foreground">
            {PROBLEM_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Set it once. Tyvera keeps working.
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Tyvera stores your customer list, tracks visits, and sends
                reminders or winback messages automatically. You do not need to
                open it every day.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-5">
                    <Zap className="mb-3 size-5 text-primary" />
                    <p className="font-semibold">Automated follow-ups</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Less manual texting and fewer forgotten customers.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <TrendingUp className="mb-3 size-5 text-primary" />
                    <p className="font-semibold">Revenue recovery</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bring back customers who might have quietly disappeared.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 p-6">
              <WorkflowIllustration className="h-auto w-full" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Built for small service businesses that need repeat customers.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
              <Card key={step}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      Step {step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/10 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
              Automations that recover customers
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              Tyvera runs the messages that business owners and staff usually
              forget.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {KEY_AUTOMATIONS.map(({ name, benefit }) => (
                <Card key={name} className="p-6">
                  <CardContent className="p-0">
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

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            Before and after
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Card className="p-6">
              <CardContent className="p-0">
                <h3 className="font-semibold text-muted-foreground">Before</h3>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-card-foreground">
                  {BEFORE_AFTER.before.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5 p-6">
              <CardContent className="p-0">
                <h3 className="font-semibold text-foreground">After Tyvera</h3>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-foreground">
                  {BEFORE_AFTER.after.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Built first for Philippine service businesses
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Tyvera works best when customers book ahead or come back
              regularly.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                "Salons",
                "Barbershops",
                "Clinics",
                "Dental Clinics",
                "Gyms",
                "Spas",
              ].map((biz) => (
                <Badge key={biz} variant="outline" className="text-sm">
                  {biz}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2">
              <Shield className="size-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Your data stays yours
              </h2>
            </div>

            <p className="mt-2 text-muted-foreground">
              Tyvera helps you organize your customer list and automate
              follow-ups. You can view and export your data anytime.
            </p>

            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map(({ q, a }, i) => (
                <AccordionItem key={q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                  <AccordionContent>{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />

          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
                <h2 className="max-w-xl text-2xl font-semibold text-foreground sm:text-3xl">
                  Start free. Recover customers automatically. Pay more only
                  when your usage grows.
                </h2>

                <p className="max-w-lg leading-relaxed text-muted-foreground">
                  Tyvera is built for small service businesses that want fewer
                  no-shows, more repeat visits, and less manual texting.
                </p>

                <PrimaryPageAction className="w-full sm:w-auto sm:justify-center lg:justify-start">
                  <LandingCta singlePrimary />
                </PrimaryPageAction>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 shadow-lg">
                <SuccessIllustration className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          Tyvera — Customer recovery automation for Philippine service
          businesses.
        </div>
      </footer>
    </div>
  );
}
