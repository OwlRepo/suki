"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSignUp, verifySignUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSendCode() {
    const normalizedEmail = email.trim();
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

    const res = await startSignUp(normalizedEmail);
    setMessage(res.ok ? "Code sent" : res.message || "Failed to send code");
    if (res.ok) setCodeSent(true);
  }

  async function onCreateAccount() {
    const normalizedEmail = email.trim();
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setMessage("Verification code is required");
      return;
    }

    const res = await verifySignUp(normalizedEmail, normalizedCode, password);
    if (res.ok) {
      router.push("/dashboard");
      return;
    }
    setMessage(res.message || "Invalid code");
  }

  return (
    <div
      data-testid="auth-page-shell"
      className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white px-4 py-8 sm:px-6"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div
          data-testid="auth-card"
          className="w-full rounded-2xl border border-blue-100 bg-white/95 p-6 shadow-lg shadow-blue-100/60 sm:p-8"
        >
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create account</h1>
            <p className="text-sm text-slate-600">Get started with Tyvera in a few steps.</p>
          </div>

          <div className="space-y-4">
            {!codeSent ? (
              <>
                <label className="text-sm font-medium text-slate-700" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="min-h-[46px] w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-base outline-none ring-blue-200 transition focus:ring-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="min-h-[46px] w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-base outline-none ring-blue-200 transition focus:ring-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="min-h-[46px] w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-base outline-none ring-blue-200 transition focus:ring-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button className="min-h-[46px] w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={onSendCode}>Send code</button>
              </>
            ) : (
              <>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Enter the code sent to {email.trim()}.
                </p>
                <label className="text-sm font-medium text-slate-700" htmlFor="code">Code</label>
                <input
                  id="code"
                  className="min-h-[46px] w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-base outline-none ring-blue-200 transition focus:ring-2"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button className="min-h-[46px] w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={onCreateAccount}>Create account</button>
              </>
            )}
            {message ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
