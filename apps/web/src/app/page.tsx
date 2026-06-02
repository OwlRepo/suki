import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  Check,
  Dumbbell,
  Heart,
  MessageSquare,
  RefreshCw,
  Scissors,
  Shield,
  Sparkles,
  Syringe,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AuthCta } from "@/components/auth-cta";
import { LandingCta } from "@/components/landing-cta";
import { HeroIllustration } from "@/components/landing/hero-illustration";
import { WorkflowIllustration } from "@/components/landing/workflow-illustration";
import { SuccessIllustration } from "@/components/landing/success-illustration";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";

type TyveraMarkProps = {
  className?: string;
};

function TyveraMark({ className = "h-8 w-8" }: TyveraMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="5" y="6" width="38" height="10" rx="5" fill="currentColor" />
      <rect
        x="19"
        y="14"
        width="10"
        height="28"
        rx="5"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

const TRUST_CHIPS = [
  "All core features available",
  "No payment setup required",
  "Built for repeat-visit businesses",
  "Fast setup for small teams",
] as const;

const OUTCOME_STATS = [
  {
    icon: BarChart3,
    label: "Fewer no-shows",
    value: "Customers get reminded before their appointment.",
    source: "Automated confirmation and reminder messages.",
  },
  {
    icon: CalendarCheck,
    label: "Recovered bookings",
    value: "Recovered bookings help keep your calendar full and revenue steady.",
    source: "Built for salons, clinics, gyms, spas, and repeat-visit businesses.",
  },
  {
    icon: Shield,
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
    icon: CalendarCheck,
    name: "Appointment reminders",
    benefit: "Confirmation and 24-hour reminders reduce forgotten bookings.",
  },
  {
    icon: RefreshCw,
    name: "Missed appointment recovery",
    benefit: "Send a rebook message after a missed appointment.",
  },
  {
    icon: Heart,
    name: "Post-visit follow-ups",
    benefit:
      "Thank customers and invite them to book again while the visit is fresh.",
  },
  {
    icon: Users,
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

const BUSINESS_TYPES = [
  { name: "Salons", icon: Scissors },
  { name: "Barbershops", icon: Sparkles },
  { name: "Clinics", icon: Syringe },
  { name: "Dental Clinics", icon: Shield },
  { name: "Gyms", icon: Dumbbell },
  { name: "Spas", icon: Heart },
] as const;

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
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-950"
          >
            <TyveraMark className="h-8 w-8 shrink-0 text-blue-600" />
            <span>Tyvera</span>
          </Link>

          <AuthCta />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-100/70">
          <div className="absolute inset-x-0 bottom-0 h-[52%] opacity-70">
            <div className="absolute -bottom-44 -left-24 h-80 w-[52rem] rounded-[50%] border border-white/80" />
            <div className="absolute -bottom-36 -left-20 h-72 w-[50rem] rounded-[50%] border border-white/80" />
            <div className="absolute -bottom-28 -left-16 h-64 w-[48rem] rounded-[50%] border border-white/80" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center lg:gap-14 lg:py-20">
            <div className="min-w-0">
              <div className="flex max-w-xl flex-wrap gap-2">
                {TRUST_CHIPS.map((chip) => (
                  <Badge
                    key={chip}
                    variant="secondary"
                    className="border border-blue-100 bg-white/80 px-3 py-1 text-[11px] font-medium text-blue-700 shadow-sm"
                  >
                    {chip}
                  </Badge>
                ))}
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Recover lost customers automatically.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Tyvera helps Philippine service businesses reduce no-shows,
                send follow-ups, and bring customers back automatically.
              </p>

              <div className="mt-6 max-w-xl rounded-2xl border border-blue-200 bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="flex gap-3">
                  <Shield className="mt-0.5 size-5 shrink-0 text-blue-600" />
                  <p className="text-sm font-semibold leading-6 text-slate-800">
                    Free mode is active with core features enabled and sensible
                    daily limits to prevent abuse.
                  </p>
                </div>
              </div>

              <PrimaryPageAction className="mt-6 w-full sm:w-auto [&>div]:justify-start">
                <LandingCta singlePrimary />
              </PrimaryPageAction>
            </div>

            <div className="flex min-w-0 items-center justify-center">
              <div className="w-full max-w-[30rem] overflow-hidden rounded-3xl border border-blue-100 bg-white/70 p-4 shadow-xl shadow-blue-100/60 backdrop-blur sm:p-6">
                <div className="aspect-[4/3] w-full">
                  <HeroIllustration className="block h-full w-full object-contain" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
            {OUTCOME_STATS.map(({ icon: Icon, label, value, source }, index) => (
              <div
                key={label}
                className={`flex min-w-0 gap-3 ${
                  index > 0 ? "sm:border-l sm:border-slate-200 sm:pl-6" : ""
                }`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Icon className="size-5" />
                </span>

                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{value}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{source}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              The problem is not bad service. It is forgotten follow-up.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Customers forget appointments. Staff get busy. Follow-ups are
              missed. Tyvera makes sure the right message still gets sent.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-3xl gap-x-8 gap-y-3 sm:grid-cols-2">
            {PROBLEM_POINTS.map((point) => (
              <div
                key={point}
                className="flex min-w-0 items-start gap-3 text-sm text-slate-600"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-slate-50/60">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)] lg:items-center">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Set it once. Tyvera keeps working.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Tyvera stores your customer list, tracks visits, and sends
                reminders or winback messages automatically. You do not need to
                open it every day.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                  <CardContent className="p-5">
                    <Zap className="size-5 text-blue-600" />
                    <p className="mt-4 font-semibold text-slate-900">
                      Automated follow-ups
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Less manual texting and fewer forgotten customers.
                    </p>
                  </CardContent>
                </Card>

                <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                  <CardContent className="p-5">
                    <TrendingUp className="size-5 text-blue-600" />
                    <p className="mt-4 font-semibold text-slate-900">
                      Revenue recovery
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Bring back customers who might have quietly disappeared.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
              <div className="aspect-[4/3] w-full">
                <WorkflowIllustration className="block h-full w-full object-contain" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              How it works
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Built for small service businesses that need repeat customers.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }, index) => (
              <Card
                key={step}
                className="relative h-full border-slate-200/80 bg-white shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Step {step}
                    </span>
                  </div>

                  <h3 className="mt-5 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </CardContent>

                {index < HOW_IT_WORKS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-xl text-blue-600 md:block"
                  >
                    →
                  </span>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-slate-50/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Automations that recover customers
              </h2>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Tyvera runs the messages that business owners and staff usually forget.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {KEY_AUTOMATIONS.map(({ icon: Icon, name, benefit }) => (
                <Card
                  key={name}
                  className="h-full border-slate-200/80 bg-white shadow-sm"
                >
                  <CardContent className="flex gap-4 p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="size-5" />
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{name}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{benefit}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Before and after
          </h2>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card className="h-full border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-slate-600">Before</h3>

                <div className="mt-4 space-y-3">
                  {BEFORE_AFTER.before.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-slate-600"
                    >
                      <X className="size-4 shrink-0 text-slate-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-full border-blue-200 bg-blue-50/70 shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-slate-900">After Tyvera</h3>

                <div className="mt-4 space-y-3">
                  {BEFORE_AFTER.after.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-slate-700"
                    >
                      <Check className="size-4 shrink-0 text-blue-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-slate-50/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-18">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Built first for Philippine service businesses
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Tyvera works best when customers book ahead or come back regularly.
            </p>

            <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-3">
              {BUSINESS_TYPES.map(({ name, icon: Icon }) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="gap-2 rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                >
                  <Icon className="size-4 shrink-0 text-blue-600" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Shield className="size-6 shrink-0 text-blue-600" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Your data stays yours
                </h2>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                Tyvera helps you organize your customer list and automate follow-ups.
                You can view and export your data anytime.
              </p>
            </div>

            <Accordion type="single" collapsible className="min-w-0">
              {FAQ.map(({ q, a }, index) => (
                <AccordionItem key={q} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-sm font-semibold text-slate-900">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-slate-600">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-100/70">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] lg:items-center">
            <div className="min-w-0">
              <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Start free. Recover customers automatically. Pay more only when
                your usage grows.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Tyvera is built for small service businesses that want fewer
                no-shows, more repeat visits, and less manual texting.
              </p>

              <PrimaryPageAction className="mt-6 w-full sm:w-auto [&>div]:justify-start">
                <LandingCta singlePrimary />
              </PrimaryPageAction>
            </div>

            <div className="min-w-0 overflow-hidden rounded-3xl border border-blue-100 bg-white/70 p-4 shadow-sm">
              <div className="aspect-[4/3] w-full">
                <SuccessIllustration className="block h-full w-full object-contain" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-center text-xs text-slate-500 sm:flex-row sm:px-6 sm:text-left">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-slate-900"
          >
            <TyveraMark className="h-5 w-5 shrink-0 text-blue-600" />
            Tyvera
          </Link>

          <span>
            Tyvera — Customer recovery automation for Philippine service businesses.
          </span>

          <span>© {new Date().getFullYear()} Tyvera</span>
        </div>
      </footer>
    </div>
  );
}
