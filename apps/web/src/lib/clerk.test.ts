import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("hasClerk", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadHasClerk(): Promise<boolean> {
    const mod = await import("./clerk");
    return mod.hasClerk;
  }

  it("returns false when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing", async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    expect(await loadHasClerk()).toBe(false);
  });

  it("returns false when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is empty", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "";
    expect(await loadHasClerk()).toBe(false);
  });

  it("returns false when key contains placeholder", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_placeholder_xxx";
    expect(await loadHasClerk()).toBe(false);
  });

  it("returns true when key is set and does not contain placeholder", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc123real";
    expect(await loadHasClerk()).toBe(true);
  });
});
