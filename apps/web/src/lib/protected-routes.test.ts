import { describe, it, expect } from "vitest";
import { isPublicPath, isProtectedPath } from "./protected-routes";

describe("protected route map", () => {
  it("keeps public routes open", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-up")).toBe(true);
    expect(isPublicPath("/intake/abc")).toBe(true);
  });

  it("protects all dashboard routes", () => {
    const routes = [
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
    ];

    for (const route of routes) {
      expect(isProtectedPath(route)).toBe(true);
    }
  });

  it("does not accidentally mark unknown routes as protected", () => {
    expect(isProtectedPath("/favicon.ico")).toBe(false);
    expect(isProtectedPath("/api/health")).toBe(false);
  });
});
