import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentsController } from "./appointments.controller";

describe("AppointmentsController booking security readiness", () => {
  const appointmentsService = {
    getBookingSecurityStatus: vi.fn(),
  };

  let controller: AppointmentsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AppointmentsController(appointmentsService as never);
  });

  it("returns pinConfigured state", async () => {
    appointmentsService.getBookingSecurityStatus.mockResolvedValue({ pinConfigured: true });
    await expect(controller.getBookingSecurityStatus("biz1", "org1")).resolves.toEqual({ pinConfigured: true });
  });

  it("requires businessId", async () => {
    await expect(controller.getBookingSecurityStatus("", "org1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
