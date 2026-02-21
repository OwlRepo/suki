import { describe, it, expect } from "vitest";
import {
  isPathAllowedForStep,
  getStepGuidance,
  STEP_GUIDANCE,
  STEP_GUIDANCE_BY_BUSINESS_TYPE,
} from "./onboarding";

describe("isPathAllowedForStep", () => {
  it("allows /onboarding for any step", () => {
    expect(isPathAllowedForStep(1, "/onboarding")).toBe(true);
    expect(isPathAllowedForStep(1, "/onboarding/extra")).toBe(true);
    expect(isPathAllowedForStep(8, "/onboarding")).toBe(true);
  });

  it("allows only /onboarding for step 1 (setup inline)", () => {
    expect(isPathAllowedForStep(1, "/dashboard")).toBe(false);
    expect(isPathAllowedForStep(1, "/customers")).toBe(false);
    expect(isPathAllowedForStep(1, "/setup")).toBe(false);
  });

  it("blocks /dashboard for step 2", () => {
    expect(isPathAllowedForStep(2, "/dashboard")).toBe(false);
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

  it("blocks /promos for step 6", () => {
    expect(isPathAllowedForStep(6, "/promos")).toBe(false);
  });

  it("blocks /loyalty for step 7", () => {
    expect(isPathAllowedForStep(7, "/loyalty")).toBe(false);
  });

  it("blocks /imports for step 8", () => {
    expect(isPathAllowedForStep(8, "/imports")).toBe(false);
  });
});

describe("getStepGuidance", () => {
  it("returns default guidance when businessType is null or undefined", () => {
    const step1 = getStepGuidance(1, null);
    expect(step1.message).toBe(STEP_GUIDANCE[1].message);
  });

  it("returns default guidance for unknown business type", () => {
    const step3 = getStepGuidance(3, "unknown");
    expect(step3.message).toBe(STEP_GUIDANCE[3].message);
  });

  it("returns salon-specific guidance when businessType is salon", () => {
    const step3 = getStepGuidance(3, "salon");
    expect(step3.message).toContain("haircut");
  });

  it("returns clinic-specific guidance when businessType is clinic", () => {
    const step3 = getStepGuidance(3, "clinic");
    expect(step3.message).toContain("patient");
  });

  it("returns restaurant-specific guidance when businessType is restaurant", () => {
    const step3 = getStepGuidance(3, "restaurant");
    expect(step3.message).toContain("takeout");
  });
});
