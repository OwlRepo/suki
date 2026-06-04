import Link from "next/link";
import {
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
  "Free during early access",
  "Built for repeat-visit businesses",
  "Guided booking with OTP verification",
  "Automated customer follow-ups",
] as const;

const OUTCOME_STATS = [
  {
    icon: CalendarCheck,
    label: "Appointments come in",
    value:
      "Customers request a schedule through a guided booking flow instead of lengthy message threads.",
    source: "Date and time selection, booking review, and OTP verification.",
  },
  {
    icon: MessageSquare,
    label: "Messages go out",
    value:
      "Routine reminders and follow-ups continue running without staff remembering every message.",
    source:
      "Appointment reminders, missed-appointment recovery, post-visit follow-ups, and winback.",
  },
  {
    icon: RefreshCw,
    label: "Return visits are encouraged",
    value:
      "Completed appointments become opportunities to invite customers back at the right time.",
    source: "Post-visit follow-ups and inactivity winback workflows.",
  },
] as const;

const PROBLEM_POINTS = [
  "Customers forget appointments and leave valuable slots unused.",
  "Busy staff cannot consistently send every reminder and follow-up.",
  "Manual visit tracking becomes unreliable when the day gets hectic.",
  "Owners spend time checking routine work instead of handling exceptions.",
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: CalendarCheck,
    title: "Customers book",
    description:
      "Customers choose their preferred date and time through a guided booking flow with review and OTP verification.",
  },
  {
    step: "2",
    icon: MessageSquare,
    title: "Routine messages go out",
    description:
      "Tyvera sends appointment reminders and follow-ups automatically, reducing repetitive manual texting.",
  },
  {
    step: "3",
    icon: RefreshCw,
    title: "Completed visits lead to rebooking",
    description:
      "Customer history stays connected to appointments, so post-visit and inactivity follow-ups can encourage the next visit.",
  },
  {
    step: "4",
    icon: Shield,
    title: "Your team focuses on exceptions",
    description:
      "Instead of manually checking every customer, your team spends more time on appointments that need an actual decision.",
  },
] as const;

const KEY_AUTOMATIONS = [
  {
    icon: CalendarCheck,
    name: "Appointment reminders",
    benefit:
      "Send confirmation and reminder messages before the scheduled visit.",
  },
  {
    icon: RefreshCw,
    name: "Missed-appointment recovery",
    benefit:
      "Invite customers to rebook after a missed appointment instead of quietly losing them.",
  },
  {
    icon: Heart,
    name: "Post-visit rebooking",
    benefit:
      "Thank customers after a completed visit and encourage them to book again.",
  },
  {
    icon: Users,
    name: "Inactivity winback",
    benefit:
      "Reach customers who have not returned after a configured period of inactivity.",
  },
] as const;

const BEFORE_AFTER = {
  before: [
    "Manual reminders sent one customer at a time",
    "Appointment details spread across message threads",
    "Visit history tracked through memory or notebooks",
    "Repeat customers forgotten when staff gets busy",
  ],
  after: [
    "Guided booking in one organized flow",
    "Routine reminders and follow-ups run automatically",
    "Customer history stays connected to appointments",
    "More time spent on customers who actually need attention",
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
    a: "Yes. Tyvera is currently free to use during early validation, with core features enabled and sensible daily usage limits.",
  },
  {
    q: "Do I need to open Tyvera every day?",
    a: "Tyvera is designed to reduce daily admin. Routine reminders and follow-ups run automatically. Your team still reviews appointments that need a decision and updates appointment statuses when necessary.",
  },
  {
    q: "How does Tyvera help bring customers back?",
    a: "Tyvera sends post-visit follow-ups, missed-appointment recovery messages, and inactivity winback messages so customers receive a timely reason to book again.",
  },
  {
    q: "How are repeat visits tracked?",
    a: "Customer history stays connected to appointments. Completed appointments can be used for post-visit follow-ups, repeat-customer insights, and inactivity winback workflows.",
  },
  {
    q: "Is Tyvera only for the Philippines?",
    a: "Tyvera is designed first for Philippine service businesses, especially salons, clinics, gyms, spas, and other businesses where customers book ahead or return regularly.",
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
                Appointments come in. Tyvera keeps customers coming back.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Tyvera helps Philippine service businesses accept bookings,
                send routine reminders and follow-ups automatically, and
                encourage repeat visits without managing every customer
                manually.
              </p>

              <div className="mt-6 max-w-xl rounded-2xl border border-blue-200 bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="flex gap-3">
                  <Zap className="mt-0.5 size-5 shrink-0 text-blue-600" />
                  <p className="text-sm font-semibold leading-6 text-slate-800">
                    Automate the routine. Spend more time only on appointments
                    that actually need your attention.
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
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Most appointment work should not require daily checking.
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Customers forget. Staff get busy. Manual follow-ups become
              inconsistent. Tyvera keeps the routine moving so fewer customers
              quietly disappear.
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
                Automate the routine. Focus on the exceptions.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Tyvera handles repeatable communication around bookings and
                return visits. Instead of relying on memory, spreadsheets, or
                manual texting, your team focuses on customers and the
                appointments that require a decision.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                  <CardContent className="p-5">
                    <Zap className="size-5 text-blue-600" />

                    <p className="mt-4 font-semibold text-slate-900">
                      Routine messages keep running
                    </p>

                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Reduce repetitive texting without forgetting important
                      customer follow-ups.
                    </p>
                  </CardContent>
                </Card>

                <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                  <CardContent className="p-5">
                    <TrendingUp className="size-5 text-blue-600" />

                    <p className="mt-4 font-semibold text-slate-900">
                      Return visits stay visible
                    </p>

                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Encourage repeat bookings before good customers quietly
                      disappear.
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
              A simple loop from booking to return visit
            </h2>

            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Keep the customer journey moving without adding more daily admin.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
              <Card
                key={step}
                className="h-full border-slate-200/80 bg-white shadow-sm"
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
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-slate-50/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Messages that keep the customer journey moving
              </h2>

              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Tyvera sends the follow-ups that busy owners and staff often
                forget.
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
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {benefit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Less manual admin. More attention where it matters.
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
              Tyvera works best when customers book ahead or return regularly.
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
                  Your customer data stays yours
                </h2>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                Tyvera helps you organize customer history and automate
                follow-ups. You can view and export your data anytime.
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
                Let Tyvera handle the routine follow-up.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Spend less time manually chasing appointments and more time
                serving customers, handling exceptions, and growing repeat
                visits.
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
            Tyvera — Appointment and customer recovery automation for Philippine
            service businesses.
          </span>

          <span>© {new Date().getFullYear()} Tyvera</span>
        </div>
      </footer>
    </div>
  );
}