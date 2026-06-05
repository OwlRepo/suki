import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeController } from "./intake.controller";

const limitMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const valuesMock = vi.fn();
const returningMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    insert: insertMock,
  }),
  customers: {},
  businesses: { id: "id" },
}));

describe("IntakeController mobile validation", () => {
  const templatesService = {};
  const bookingService = {
    createHold: vi.fn(),
    sendOtp: vi.fn(),
    verifyAndConfirm: vi.fn(),
  };
  const customersService = {
    resolveForPublicIntake: vi.fn(),
  };
  let controller: IntakeController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new IntakeController(
      templatesService as never,
      bookingService as never,
      customersService as never,
    );
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ limit: limitMock });
    limitMock.mockResolvedValue([{ id: "biz1" }]);
    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockReturnValue({ returning: returningMock });
    returningMock.mockResolvedValue([{ id: "cust1", mobile: "+639171234567" }]);
    customersService.resolveForPublicIntake.mockResolvedValue({
      id: "cust1",
      mobile: "+639171234567",
    });
  });

  it("rejects invalid nonblank mobile on intake submit", async () => {
    await expect(
      controller.submit({ businessId: "biz1", name: "Alice", mobile: "09171234567" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(customersService.resolveForPublicIntake).not.toHaveBeenCalled();
  });

  it("passes normalized E.164 mobile to resolveForPublicIntake", async () => {
    await controller.submit({
      businessId: "biz1",
      name: "Alice",
      mobile: " +639171234567 ",
    });

    expect(customersService.resolveForPublicIntake).toHaveBeenCalledWith(
      "biz1",
      expect.objectContaining({ mobile: "+639171234567" }),
    );
  });

  it("returns the reused customer from CustomersService", async () => {
    customersService.resolveForPublicIntake.mockResolvedValue({
      id: "existing-cust",
      mobile: "+639171234567",
    });

    await expect(
      controller.submit({
        businessId: "biz1",
        name: "Alice",
        mobile: "+639171234567",
      }),
    ).resolves.toEqual({
      customer: { id: "existing-cust", mobile: "+639171234567" },
      success: true,
    });
  });

  it("rejects missing or invalid mobile on booking hold", async () => {
    await expect(
      controller.hold({
        businessId: "biz1",
        customerId: "cust1",
        mobile: "",
        scheduledAt: "2026-06-03T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.hold({
        businessId: "biz1",
        customerId: "cust1",
        mobile: "+63917 123 4567",
        scheduledAt: "2026-06-03T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookingService.createHold).not.toHaveBeenCalled();
  });

  it("passes normalized mobile to booking hold", async () => {
    bookingService.createHold.mockResolvedValue({ id: "hold1" });

    await controller.hold({
      businessId: "biz1",
      customerId: "cust1",
      mobile: " +639171234567 ",
      scheduledAt: "2026-06-03T10:00:00.000Z",
    });

    expect(bookingService.createHold).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: "+639171234567" }),
    );
  });
});
