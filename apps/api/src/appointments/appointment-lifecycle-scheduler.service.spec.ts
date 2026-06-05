import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentLifecycleSchedulerService } from "./appointment-lifecycle-scheduler.service";

describe("AppointmentLifecycleSchedulerService", () => {
  const appointmentsService = {
    reconcileVisitLifecycle: vi.fn(),
  };
  const featureFlags = {
    appointmentVisitAutomationEnabled: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not reconcile when appointment visit automation is disabled", async () => {
    featureFlags.appointmentVisitAutomationEnabled.mockReturnValue(false);
    const service = new AppointmentLifecycleSchedulerService(
      appointmentsService as never,
      featureFlags as never,
    );

    await service.reconcile();

    expect(appointmentsService.reconcileVisitLifecycle).not.toHaveBeenCalled();
  });

  it("reconciles when appointment visit automation is enabled", async () => {
    featureFlags.appointmentVisitAutomationEnabled.mockReturnValue(true);
    appointmentsService.reconcileVisitLifecycle.mockResolvedValue({
      completed: 1,
      needsReview: 1,
    });
    const service = new AppointmentLifecycleSchedulerService(
      appointmentsService as never,
      featureFlags as never,
    );

    await service.reconcile();

    expect(appointmentsService.reconcileVisitLifecycle).toHaveBeenCalledTimes(1);
  });
});
