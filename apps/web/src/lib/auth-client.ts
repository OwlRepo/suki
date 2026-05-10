const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ApiResult = { ok: boolean; message?: string; fallbackUnlocked?: boolean };

async function post(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}${path}`, {
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

export function startSignIn(email: string) {
  return post("/auth/sign-in/start", { email });
}

export function verifySignIn(email: string, code: string) {
  return post("/auth/sign-in/verify", { email, code });
}

export function startSignUp(email: string) {
  return post("/auth/sign-up/start", { email });
}

export function verifySignUp(email: string, code: string) {
  return post("/auth/sign-up/verify", { email, code });
}

export function signInWithPassword(email: string, password: string) {
  return post("/auth/sign-in/password", { email, password });
}

export function setPassword(email: string, password: string) {
  return post("/auth/password/set", { email, password });
}

export async function signOut() {
  return post("/auth/sign-out", {});
}

export async function getSession() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}
