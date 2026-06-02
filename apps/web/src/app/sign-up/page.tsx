"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startSignUp, verifySignUp } from "@/lib/auth-client";
import { invalidateSessionCache } from "@/hooks/use-session";
import { TyveraMark } from "../sign-in/page";

type IconProps = {
  className?: string;
};

function MailIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="16" height="12" x="4" y="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696C3.423 7.601 7.246 5 12 5c4.754 0 8.577 2.601 9.938 6.652a1 1 0 0 1 0 .696C20.577 16.399 16.754 19 12 19c-4.754 0-8.577-2.601-9.938-6.652Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 2 20 20" />
      <path d="M6.71 6.71C4.944 7.82 3.608 9.52 2.938 11.652a1 1 0 0 0 0 .696C4.299 16.399 8.122 19 12.876 19c1.472 0 2.844-.249 4.074-.7" />
      <path d="M10.73 5.08A11.3 11.3 0 0 1 12 5c4.754 0 8.577 2.601 9.938 6.652a1 1 0 0 1 0 .696 10.4 10.4 0 0 1-1.21 2.403" />
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
    </svg>
  );
}

function UserPlusIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function MessageCircleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h.01" />
      <path d="M12 9h.01" />
      <path d="M16 9h.01" />
    </svg>
  );
}

function SendIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ChartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16V5" />
    </svg>
  );
}

function ShieldIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const featureItems = [
  {
    title: "Appointment reminders",
    description:
      "Reduce no-shows with automated SMS reminders before each visit.",
    icon: MessageCircleIcon,
  },
  {
    title: "Automated follow-ups",
    description:
      "Engage customers after visits, missed bookings, and periods of inactivity.",
    icon: SendIcon,
  },
  {
    title: "Everything in one place",
    description:
      "Track customers, visits, and booking requests in a single workspace.",
    icon: ChartIcon,
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const normalizedEmail = email.trim();
  const passwordMismatch = useMemo(
    () => confirmPassword.length > 0 && password !== confirmPassword,
    [confirmPassword, password],
  );

  async function onSendCode() {
    setMessage(null);

    if (!normalizedEmail) {
      setMessage("Email is required");
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

    setIsSendingCode(true);

    try {
      const res = await startSignUp(normalizedEmail);
      setMessage(res.ok ? "Code sent" : res.message || "Failed to send code");

      if (res.ok) {
        setCodeSent(true);
      }
    } finally {
      setIsSendingCode(false);
    }
  }

  async function onCreateAccount() {
    setMessage(null);

    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setMessage("Verification code is required");
      return;
    }

    setIsCreatingAccount(true);

    try {
      const res = await verifySignUp(normalizedEmail, normalizedCode, password);

      if (res.ok) {
        invalidateSessionCache();
        router.push("/onboarding");
        router.refresh();
        return;
      }

      setMessage(res.message || "Invalid code");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  return (
    <main
      data-testid="auth-page-shell"
      className="min-h-screen overflow-hidden bg-slate-50 text-slate-950"
    >
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,37%)_minmax(0,63%)]">
        <section className="relative hidden overflow-hidden border-r border-blue-100 bg-gradient-to-br from-white via-blue-50 to-blue-100 px-10 py-10 lg:flex lg:flex-col xl:px-16 xl:py-14">
          <div className="absolute inset-x-0 bottom-0 h-[42%] opacity-80">
            <div className="absolute -bottom-32 -left-28 h-72 w-[44rem] rounded-[50%] border border-white/70" />
            <div className="absolute -bottom-24 -left-20 h-64 w-[42rem] rounded-[50%] border border-white/70" />
            <div className="absolute -bottom-16 -left-10 h-56 w-[40rem] rounded-[50%] border border-white/70" />
            <div className="absolute -bottom-8 left-4 h-48 w-[38rem] rounded-[50%] border border-white/70" />
          </div>

          <div className="relative flex items-center gap-3 text-blue-600">
            <Link
              href="/"
              className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-950"
            >
              <TyveraMark />
              Tyvera
            </Link>
          </div>

          <div className="relative my-auto max-w-xl">
            <p className="text-4xl font-bold leading-tight tracking-tight text-slate-950 xl:text-5xl">
              Create your
              <span className="block">
                <span className="text-blue-600">Tyvera</span> account
              </span>
            </p>

            <p className="mt-6 max-w-md text-base leading-7 text-slate-600 xl:text-lg">
              Get started in a few steps and begin automating the customer
              follow-ups that keep your business growing.
            </p>

            <div className="mt-10 space-y-6">
              {featureItems.map(({ title, description, icon: Icon }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-100/70 text-blue-600 shadow-sm">
                    <Icon />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {title}
                    </h2>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-sm text-slate-500">
            <ShieldIcon />
            <span>
              © {new Date().getFullYear()} Tyvera. All rights reserved.
            </span>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-blue-50/50 to-white px-4 py-8 sm:px-6 lg:px-10">
          <div className="absolute right-8 top-8 hidden grid-cols-5 gap-4 opacity-60 xl:grid">
            {Array.from({ length: 20 }).map((_, index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-blue-200"
              />
            ))}
          </div>

          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-center gap-3 text-blue-600 lg:hidden">
              <TyveraMark className="h-9 w-9" />
              <span className="text-3xl font-bold tracking-tight text-slate-950">
                Tyvera
              </span>
            </div>

            <div
              data-testid="auth-card"
              className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-10"
            >
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                  <UserPlusIcon />
                </div>

                <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
                  {codeSent ? "Verify your email" : "Create account"}
                </h1>

                <p className="mt-2 text-base text-slate-600">
                  {codeSent
                    ? "Enter the verification code we sent to your email."
                    : "Get started with Tyvera in a few steps."}
                </p>
              </div>

              <div className="mt-8 space-y-5">
                {!codeSent ? (
                  <>
                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-900"
                        htmlFor="email"
                      >
                        Email
                      </label>

                      <div className="relative">
                        <MailIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                        <input
                          id="email"
                          autoComplete="email"
                          className="min-h-14 w-full rounded-xl border border-slate-300 bg-white py-3 pl-14 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          value={email}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-900"
                        htmlFor="password"
                      >
                        Password
                      </label>

                      <div className="relative">
                        <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                        <input
                          id="password"
                          autoComplete="new-password"
                          className="min-h-14 w-full rounded-xl border border-slate-300 bg-white py-3 pl-14 pr-14 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="At least 8 characters"
                          type={showPassword ? "text" : "password"}
                          value={password}
                        />

                        <button
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-600"
                          onClick={() => setShowPassword((current) => !current)}
                          type="button"
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-900"
                        htmlFor="confirm-password"
                      >
                        Confirm password
                      </label>

                      <div className="relative">
                        <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                        <input
                          id="confirm-password"
                          autoComplete="new-password"
                          aria-invalid={passwordMismatch}
                          className="min-h-14 w-full rounded-xl border border-slate-300 bg-white py-3 pl-14 pr-14 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-100"
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder="Repeat your password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                        />

                        <button
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirmed password"
                              : "Show confirmed password"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-600"
                          onClick={() =>
                            setShowConfirmPassword((current) => !current)
                          }
                          type="button"
                        >
                          {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>

                      {passwordMismatch ? (
                        <p className="mt-2 text-sm text-rose-600">
                          Your passwords do not match.
                        </p>
                      ) : null}
                    </div>

                    <button
                      className="min-h-14 w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSendingCode}
                      onClick={onSendCode}
                      type="button"
                    >
                      {isSendingCode ? "Sending code..." : "Send code"}
                    </button>

                    <p className="text-center text-sm text-slate-500">
                      We&apos;ll send a verification code to your email.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
                      Enter the code sent to{" "}
                      <span className="font-semibold">{normalizedEmail}</span>.
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-900"
                        htmlFor="code"
                      >
                        Verification code
                      </label>

                      <input
                        id="code"
                        autoComplete="one-time-code"
                        className="min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        inputMode="numeric"
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="Enter code"
                        value={code}
                      />
                    </div>

                    <button
                      className="min-h-14 w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isCreatingAccount}
                      onClick={onCreateAccount}
                      type="button"
                    >
                      {isCreatingAccount
                        ? "Creating account..."
                        : "Create account"}
                    </button>

                    <button
                      className="w-full text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                      onClick={() => {
                        setCodeSent(false);
                        setCode("");
                        setMessage(null);
                      }}
                      type="button"
                    >
                      Use a different email
                    </button>
                  </>
                )}

                {message ? (
                  <p
                    aria-live="polite"
                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700"
                  >
                    {message}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                className="font-semibold text-blue-600 transition hover:text-blue-700"
                href="/sign-in"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
