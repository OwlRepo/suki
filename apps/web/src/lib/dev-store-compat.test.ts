import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDevOverrides, getDevApiUrl, getDevMockFailure, getDevMockLatencyMs, setDevApiUrl } from "./dev-store";

describe("Suki development preference compatibility", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("edge: retains legacy API, latency and failure preferences", () => {
    localStorage.setItem("tyvera_dev_api_url", "http://localhost:3001");
    localStorage.setItem("tyvera_dev_mock_latency_ms", "300");
    localStorage.setItem("tyvera_dev_mock_failure", "true");
    expect(getDevApiUrl()).toBe("http://localhost:3001");
    expect(getDevMockLatencyMs()).toBe(300);
    expect(getDevMockFailure()).toBe(true);
  });

  it("regression: canonical preferences override legacy values", () => {
    localStorage.setItem("tyvera_dev_api_url", "http://localhost:3001");
    localStorage.setItem("suki_dev_api_url", "http://localhost:4001");
    localStorage.setItem("tyvera_dev_mock_failure", "true");
    localStorage.setItem("suki_dev_mock_failure", "false");
    expect(getDevApiUrl()).toBe("http://localhost:4001");
    expect(getDevMockFailure()).toBe(false);
  });

  it("regression: clearing overrides cannot reactivate legacy values", () => {
    localStorage.setItem("tyvera_dev_api_url", "http://localhost:3001");
    localStorage.setItem("suki_dev_api_url", "http://localhost:4001");
    clearDevOverrides();
    expect(getDevApiUrl()).toBeNull();
  });

  it("happy: writes preferences under Suki without deleting legacy values", () => {
    localStorage.setItem("tyvera_dev_api_url", "http://localhost:3001");
    setDevApiUrl("http://localhost:4001");
    expect(localStorage.getItem("suki_dev_api_url")).toBe("http://localhost:4001");
    expect(localStorage.getItem("tyvera_dev_api_url")).toBe("http://localhost:3001");
  });
});
