import { describe, expect, it, vi } from "vitest";
import { PlanCapacityService } from "./plan-capacity.service";

describe("PlanCapacityService", () => {
  it("enforces module access by plan", () => {
    const service = new PlanCapacityService(
      {
        founderLedModeEnabled: vi.fn().mockReturnValue(false),
      } as never,
      {
        getOrgBillingState: vi.fn(),
      } as never,
    );

    expect(service.hasModuleAccess("free", "imports")).toBe(false);
    expect(service.hasModuleAccess("starter", "imports")).toBe(true);
    expect(service.hasModuleAccess("starter", "auto_winback")).toBe(false);
    expect(service.hasModuleAccess("growth", "auto_winback")).toBe(true);
    expect(service.hasModuleAccess("pro", "multi_branch")).toBe(true);
  });

  it("returns plan-specific business limits", async () => {
    const service = new PlanCapacityService(
      {
        founderLedModeEnabled: vi.fn().mockReturnValue(true),
      } as never,
      {
        getOrgBillingState: vi.fn().mockResolvedValue({ currentPlan: "free", isReadOnly: false }),
      } as never,
    );

    await expect(service.getBusinessLimitByOrg("org-1")).resolves.toBe(1);
  });

  it("returns read-only only for enforced read-only billing states", async () => {
    const service = new PlanCapacityService(
      {
        founderLedModeEnabled: vi.fn().mockReturnValue(true),
      } as never,
      {
        getOrgBillingState: vi.fn().mockResolvedValue({ currentPlan: "free", isReadOnly: true }),
      } as never,
    );

    await expect(service.isReadOnly("org-1")).resolves.toBe(true);
  });
});
