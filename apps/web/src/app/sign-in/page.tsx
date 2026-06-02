"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/auth-client";
import { invalidateSessionCache } from "@/hooks/use-session";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onPasswordSignIn() {
    const res = await signInWithPassword(email.trim(), password);
    if (res.ok) {
      invalidateSessionCache();
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(res.message || "Invalid credentials");
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
            <p className="text-sm text-slate-600">Welcome back. Enter your email and password to continue.</p>
          </div>

          <div className="space-y-4">
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
            <button className="min-h-[46px] w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700" onClick={onPasswordSignIn}>Sign in</button>
            {message ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
