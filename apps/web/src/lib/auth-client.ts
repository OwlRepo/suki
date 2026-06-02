import { buildApiUrl } from "./api-base";

type ApiResult = {
  ok: boolean;
  message?: string;
  fallbackUnlocked?: boolean;
  redirectTo?: "/onboarding" | "/dashboard";
};

async function post(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message: (data as { message?: string }).message || "Request failed",
      fallbackUnlocked: (data as { fallbackUnlocked?: boolean }).fallbackUnlocked,
    };
  }
  return { ok: true, ...(data as Record<string, unknown>) } as ApiResult;
}

export function startSignUp(email: string) {
  return post("/auth/sign-up/start", { email });
}

export function verifySignUp(email: string, code: string, password: string) {
  return post("/auth/sign-up/verify", { email, code, password });
}

export function signInWithPassword(email: string, password: string) {
  return post("/auth/sign-in/password", { email, password });
}

export function startPasswordReset(email: string) {
  return post("/auth/password-reset/start", { email });
}

export function verifyPasswordReset(email: string, code: string, password: string) {
  return post("/auth/password-reset/verify", { email, code, password });
}

export async function signOut() {
  return post("/auth/sign-out", {});
}

export async function getSession() {
  const res = await fetch(buildApiUrl("/auth/me"), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}
