import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApiUrl, getApiBaseUrl } from "./api-base";

describe("api base URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults browser production requests to the same-origin API proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(getApiBaseUrl()).toBe("/api");
    expect(buildApiUrl("/auth/sign-up/start")).toBe("/api/auth/sign-up/start");
  });

  it("keeps localhost as the development default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(getApiBaseUrl()).toBe("http://localhost:3001");
    expect(buildApiUrl("/auth/me")).toBe("http://localhost:3001/auth/me");
  });

  it("honors an explicit public API URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.test/api");

    expect(getApiBaseUrl()).toBe("https://example.test/api");
    expect(buildApiUrl("/health")).toBe("https://example.test/api/health");
  });
});
