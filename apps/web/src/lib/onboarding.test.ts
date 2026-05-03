import { describe, it, expect } from "vitest";
import {
  isPathAllowedForStep,
  getStepGuidance,
  STEP_GUIDANCE,
} from "./onboarding";

describe("isPathAllowedForStep", () => {
  it("allows /onboarding for any step", () => {
    expect(isPathAllowedForStep(1, "/onboarding")).toBe(true);
    expect(isPathAllowedForStep(1, "/onboarding/extra")).toBe(true);
    expect(isPathAllowedForStep(6, "/onboarding")).toBe(true);
  });

  it("allows /dashboard during onboarding", () => {
    expect(isPathAllowedForStep(1, "/dashboard")).toBe(true);
  });

  it("blocks other app routes for step 1 (setup inline)", () => {
    expect(isPathAllowedForStep(1, "/customers")).toBe(false);
    expect(isPathAllowedForStep(1, "/setup")).toBe(false);
  });

  it("blocks /customers for step 2", () => {
    expect(isPathAllowedForStep(2, "/dashboard")).toBe(true);
    expect(isPathAllowedForStep(2, "/customers")).toBe(false);
  });

  it("blocks /customers for steps 3 and 4", () => {
    expect(isPathAllowedForStep(3, "/customers")).toBe(false);
    expect(isPathAllowedForStep(4, "/customers")).toBe(false);
  });

  it("blocks /appointments and /customers for step 5", () => {
    expect(isPathAllowedForStep(5, "/appointments")).toBe(false);
    expect(isPathAllowedForStep(5, "/customers")).toBe(false);
  });

  it("blocks /imports for step 6", () => {
    expect(isPathAllowedForStep(6, "/imports")).toBe(false);
  });
});

describe("getStepGuidance", () => {
  it("returns default guidance when businessType is null or undefined", () => {
    const step1 = getStepGuidance(1, null);
    expect(step1.title).toBe(STEP_GUIDANCE[1].title);
  });

  it("returns default guidance for unknown business type", () => {
    const step3 = getStepGuidance(3, "unknown");
    expect(step3.title).toBe(STEP_GUIDANCE[3].title);
  });

  it("uses deterministic default guidance for known business types in MVP", () => {
    const step3 = getStepGuidance(3, "salon");
    expect(step3.title).toBe(STEP_GUIDANCE[3].title);
  });
});
