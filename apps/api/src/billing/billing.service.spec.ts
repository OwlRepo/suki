import { describe, it, expect } from "vitest";
import { BillingService } from "./billing.service";

describe("BillingService", () => {
  const service = new BillingService();

  it("getPlans returns all plans with prices", () => {
    const plans = service.getPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.planType)).toContain("starter");
    expect(plans.map((p) => p.planType)).toContain("growth");
    expect(plans.map((p) => p.planType)).toContain("pro");
    expect(plans.find((p) => p.planType === "starter")?.pricePhp).toBe(299);
    expect(plans.find((p) => p.planType === "growth")?.pricePhp).toBe(799);
    expect(plans.find((p) => p.planType === "pro")?.pricePhp).toBe(1499);
  });
});
