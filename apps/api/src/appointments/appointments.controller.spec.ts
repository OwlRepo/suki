import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentsController } from "./appointments.controller";

describe("AppointmentsController booking security", () => {
  const appointmentsService = {
    setOtpSkipPin: vi.fn(),
  };

  let controller: AppointmentsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AppointmentsController(appointmentsService as never);
  });

  it("forwards owner pin setup payload", async () => {
    appointmentsService.setOtpSkipPin.mockResolvedValue({ success: true });
    await expect(
      controller.setBookingPin(
        { businessId: "biz1", pin: "1234" },
        { organizationId: "org1", userId: "u1", role: "owner" },
      ),
    ).resolves.toEqual({ success: true });
  });

  it("surfaces owner-only errors", async () => {
    appointmentsService.setOtpSkipPin.mockRejectedValue(new ForbiddenException("Owner only"));
    await expect(
      controller.setBookingPin(
        { businessId: "biz1", pin: "1234" },
        { organizationId: "org1", userId: "u1", role: "staff" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
