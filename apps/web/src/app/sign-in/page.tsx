"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/auth-client";
import { invalidateSessionCache } from "@/hooks/use-session";

export function TyveraMark() {
  return (
    <span className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
      <span className="absolute top-1 h-3 w-9 rounded-full bg-linear-to-r from-blue-700 via-blue-500 to-sky-300" />
      <span className="absolute top-2 h-8 w-4 rounded-b-xl rounded-t-md bg-linear-to-b from-blue-600 to-blue-500" />
    </span>
  );
}

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden ? null : <path d="m4 4 16 16" />}
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: "calendar" | "message" | "users" }) {
  if (type === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18" />
        <path d="m8 14 2 2 5-5" />
      </svg>
    );
  }

  if (type === "message") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 8h8M8 12h5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const features = [
  {
    title: "Appointment reminders",
    description: "Help customers remember upcoming visits without manual follow-ups.",
    icon: "calendar" as const,
  },
  {
    title: "Automated follow-ups",
    description: "Send the right message after a visit, missed booking, or long inactivity.",
    icon: "message" as const,
  },
  {
    title: "Customers in one place",
    description: "Track customers, visits, and booking requests from one workspace.",
    icon: "users" as const,
  },
];

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onPasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const res = await signInWithPassword(email.trim(), password);

      if (res.ok) {
        invalidateSessionCache();
        router.push(res.redirectTo ?? "/dashboard");
        router.refresh();
        return;
      }

      setMessage(res.message || "Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main data-testid="auth-page-shell" className="relative min-h-screen overflow-hidden bg-white text-slate-950 antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(219,234,254,0.65),transparent_34%),radial-gradient(circle_at_92%_80%,rgba(239,246,255,0.72),transparent_34%)]" />

      <div className="relative grid min-h-screen lg:grid-cols-[37%_63%]">
        <section className="relative hidden overflow-hidden border-r border-blue-100 bg-gradient-to-b from-white via-blue-50/70 to-blue-100/80 px-12 py-10 lg:flex lg:flex-col xl:px-20 xl:py-14">
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-[34rem] w-[42rem] rounded-[45%] border border-white/70" />
          <div className="pointer-events-none absolute -bottom-16 -left-32 h-[30rem] w-[47rem] rounded-[45%] border border-white/60" />
          <div className="pointer-events-none absolute -bottom-4 -left-40 h-[27rem] w-[52rem] rounded-[45%] border border-white/60" />
          <div className="pointer-events-none absolute bottom-24 right-[-9rem] h-[10rem] w-[26rem] -rotate-[14deg] bg-blue-200/35 blur-3xl" />

          <Link href="/" className="relative z-10 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950">
            <TyveraMark />
            Tyvera
          </Link>

          <div className="relative z-10 my-auto max-w-md">
            <h1 className="text-5xl font-bold leading-[1.12] tracking-tight text-slate-950">
              Bring customers back <span className="text-blue-600">automatically.</span>
            </h1>
            <p className="mt-7 text-lg leading-7 text-slate-600">
              Track visits, manage bookings, and send timely reminders and follow-ups without relying on memory.
            </p>

            <div className="mt-10 space-y-7">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-100/80 text-blue-600 shadow-sm">
                    <FeatureIcon type={feature.icon} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{feature.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-sm text-slate-500">© {new Date().getFullYear()} Tyvera. All rights reserved.</p>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
          <div className="pointer-events-none absolute right-8 top-8 grid grid-cols-5 gap-4 opacity-50">
            {Array.from({ length: 25 }).map((_, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-blue-200" />
            ))}
          </div>

          <div className="w-full max-w-xl">
            <div className="mb-6 flex justify-center lg:hidden">
              <Link href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950">
                <TyveraMark />
                Tyvera
              </Link>
            </div>

            <form
              data-testid="auth-card"
              onSubmit={onPasswordSignIn}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_20px_45px_rgba(59,130,246,0.12)] sm:p-10"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
                <LockIcon className="h-9 w-9" />
              </div>

              <div className="mt-6 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-slate-950">Sign in</h1>
                <p className="mt-2 text-base text-slate-600">Welcome back. Enter your account details to continue.</p>
              </div>

              <div className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-900">
                    Email
                  </label>
                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                    <MailIcon className="h-5 w-5 shrink-0 text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="example@email.com"
                      className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-900">
                    Password
                  </label>
                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                    <LockIcon className="h-5 w-5 shrink-0 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="text-slate-500 transition hover:text-blue-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      <EyeIcon hidden={!showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                  {isSubmitting ? null : <ArrowRightIcon />}
                </button>

                {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              New to Tyvera?{" "}
              <Link href="/sign-up" className="font-medium text-blue-600 transition hover:text-blue-700">
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
