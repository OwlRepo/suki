"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { startPasswordReset, verifyPasswordReset } from "@/lib/auth-client";
import { invalidateSessionCache } from "@/hooks/use-session";

function TyveraMark() {
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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 20 7v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4Z" />
      <path d="m9 12 2 2 4-5" />
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

type Step = "email" | "verify" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function onSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!normalizedEmail) {
      setMessage("Email is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await startPasswordReset(normalizedEmail);
      if (!res.ok) {
        setMessage(res.message || "Could not send verification code");
        return;
      }
      setStep("verify");
      setMessage("If an account exists, we sent a verification code to that email.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setMessage("Verification code is required");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyPasswordReset(normalizedEmail, normalizedCode, password);
      if (!res.ok) {
        setMessage(res.message || "Could not reset password");
        return;
      }

      setStep("done");
      invalidateSessionCache();
      router.push(res.redirectTo ?? "/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
  }

  return (
    <main data-testid="auth-page-shell" className="relative min-h-screen overflow-hidden bg-white text-slate-950 antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(219,234,254,0.65),transparent_34%),radial-gradient(circle_at_92%_80%,rgba(239,246,255,0.72),transparent_34%)]" />

      <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex justify-center">
            <Link href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950">
              <TyveraMark />
              Tyvera
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_20px_45px_rgba(59,130,246,0.12)] sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <ShieldIcon />
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950">Reset password</h1>
              <p className="mt-2 text-base text-slate-600">
                {step === "email"
                  ? "Enter your email and we will send a verification code."
                  : step === "verify"
                    ? "Enter the verification code and choose a new password."
                    : "Your session is ready."}
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={onSendCode} className="mt-8 space-y-5">
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  If an account exists, we will send a verification code to that email.
                </p>
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Sending..." : "Send code"}
                  {isSubmitting ? null : <ArrowRightIcon />}
                </button>
                {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
              </form>
            ) : null}

            {step === "verify" ? (
              <form onSubmit={onResetPassword} className="mt-8 space-y-5">
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  We sent a code to <span className="font-semibold">{normalizedEmail}</span>.
                </p>
                <div>
                  <label htmlFor="code" className="mb-2 block text-sm font-semibold text-slate-900">
                    Verification code
                  </label>
                  <input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="min-h-[56px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="123456"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-slate-900">
                    New password
                  </label>
                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                    <LockIcon className="h-5 w-5 shrink-0 text-slate-500" />
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-900">
                    Confirm password
                  </label>
                  <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                    <LockIcon className="h-5 w-5 shrink-0 text-slate-500" />
                    <input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Resetting..." : "Reset password"}
                  {isSubmitting ? null : <ArrowRightIcon />}
                </button>
                <button
                  type="button"
                  onClick={useDifferentEmail}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Use a different email
                </button>
                {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
              </form>
            ) : null}

            {step === "done" ? (
              <p className="mt-8 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Password updated. Taking you back in...
              </p>
            ) : null}
          </div>

          <p className="mt-8 text-center text-sm text-slate-600">
            Remembered your password?{" "}
            <Link href="/sign-in" className="font-medium text-blue-600 transition hover:text-blue-700">
              Back to sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
