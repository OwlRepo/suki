import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "./proxy";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/settings",
  "/imports",
  "/setup",
  "/onboarding",
  "/insights",
  "/analytics",
  "/promos",
  "/loyalty",
  "/pipeline",
] as const;

function makeRequest(pathname: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy protected-route matrix", () => {
  it("allows protected routes through for client/API session verification", () => {
    for (const route of PROTECTED_ROUTES) {
      const res = proxy(makeRequest(route));
      expect(res.status).toBe(200);
    }
  });

  it("allows all protected routes when session cookie exists", () => {
    for (const route of PROTECTED_ROUTES) {
      const res = proxy(makeRequest(route, "tyvera_session=test"));
      expect(res.status).toBe(200);
    }
  });
});
