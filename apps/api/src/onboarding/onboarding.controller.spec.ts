import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { OnboardingController } from "./onboarding.controller";
import { BillingWriteGuard } from "../common/billing-write.guard";

describe("OnboardingController", () => {
  it("does not gate progress endpoints behind BillingWriteGuard", () => {
    const guards =
      (Reflect.getMetadata(GUARDS_METADATA, OnboardingController) as unknown[]) ??
      [];
    expect(guards).not.toContain(BillingWriteGuard);
  });

  it("returns progress for the tenant even when the org is read-only", async () => {
    const service = {
      getProgress: vi.fn().mockResolvedValue({
        currentStep: 2,
        completedSteps: ["step_1", "step_2"],
        timeToFirstValueAt: null,
      }),
      updateProgress: vi.fn(),
    };
    const controller = new OnboardingController(service as never);
    const tenant = {
      organizationId: "org-1",
      userId: "user-1",
      role: "owner" as const,
    };

    await expect(controller.getProgress(tenant)).resolves.toEqual({
      currentStep: 2,
      completedSteps: ["step_1", "step_2"],
      timeToFirstValueAt: null,
    });
    expect(service.getProgress).toHaveBeenCalledWith("org-1", "user-1");
  });

  it("persists progress updates for the tenant", async () => {
    const service = {
      getProgress: vi.fn(),
      updateProgress: vi.fn().mockResolvedValue({
        currentStep: 3,
        completedSteps: ["step_1", "step_2", "step_3"],
        timeToFirstValueAt: null,
      }),
    };
    const controller = new OnboardingController(service as never);
    const tenant = {
      organizationId: "org-1",
      userId: "user-1",
      role: "owner" as const,
    };

    await controller.updateProgress(tenant, {
      currentStep: 3,
      completedSteps: ["step_1", "step_2", "step_3"],
    });

    expect(service.updateProgress).toHaveBeenCalledWith(
      "org-1",
      { currentStep: 3, completedSteps: ["step_1", "step_2", "step_3"] },
      "user-1",
    );
  });
});
