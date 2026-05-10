import { describe, it, expect } from "vitest";
import {
  HELP_CONTENT,
  searchHelpContent,
  getGuidedOnboardingModules,
} from "./help-content";

describe("help content search", () => {
  it("supports english search intents", () => {
    const results = searchHelpContent("how do i add customer", "en");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.locale).toBe("en");
  });

  it("supports tagalog search intents", () => {
    const results = searchHelpContent("paano mag add ng customer", "tl");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.locale).toBe("tl");
  });

  it("returns quick answer snippets", () => {
    const results = searchHelpContent("sms left", "en");
    expect(results.some((r) => r.quickAnswer.length > 0)).toBe(true);
  });
});

describe("guided onboarding modules", () => {
  it("reuses onboarding step ids as guide modules", () => {
    const modules = getGuidedOnboardingModules("en");
    expect(modules.length).toBeGreaterThan(0);
    expect(modules[0]?.sourceStepId).toBe(1);
  });

  it("keeps english and tagalog coverage for getting started", () => {
    const ids = new Set(HELP_CONTENT.filter((item) => item.sectionKey === "getting-started").map((item) => item.locale));
    expect(ids.has("en")).toBe(true);
    expect(ids.has("tl")).toBe(true);
  });
});
