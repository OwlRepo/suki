import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentsController } from "./appointments.controller";

describe("AppointmentsController booking security", () => {
  const appointmentsService = {
    setOtpSkipPin: vi.fn(),
    createHoldForBooking: vi.fn(),
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

  it("rejects invalid mobile for booking holds", async () => {
    await expect(
      controller.bookingHold(
        {
          businessId: "biz1",
          customerId: "cust1",
          mobile: "09171234567",
          scheduledAt: "2026-06-03T10:00:00.000Z",
        },
        "org1",
      ),
    ).rejects.toThrow();
    expect(appointmentsService.createHoldForBooking).not.toHaveBeenCalled();
  });

  it("passes normalized mobile to booking hold service", async () => {
    appointmentsService.createHoldForBooking.mockResolvedValue({ id: "hold1" });

    await controller.bookingHold(
      {
        businessId: "biz1",
        customerId: "cust1",
        mobile: " +639171234567 ",
        scheduledAt: "2026-06-03T10:00:00.000Z",
      },
      "org1",
    );

    expect(appointmentsService.createHoldForBooking).toHaveBeenCalledWith(
      "org1",
      expect.objectContaining({ mobile: "+639171234567" }),
    );
  });
});
