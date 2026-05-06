import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersController } from "./customers.controller";

describe("CustomersController sendFollowUp", () => {
  const customersService = {
    findById: vi.fn(),
  };
  const templatesService = {};
  const automationSend = {
    sendPostVisitFollowup: vi.fn(),
  };

  let controller: CustomersController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CustomersController(
      customersService as never,
      templatesService as never,
      automationSend as never,
    );
  });

  it("throws unauthorized when org is missing", async () => {
    await expect(controller.sendFollowUp("c1", undefined, "user1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("throws unauthorized when user is missing", async () => {
    await expect(controller.sendFollowUp("c1", "org1", undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("throws bad request when customer is not found", async () => {
    customersService.findById.mockResolvedValue(null);

    await expect(controller.sendFollowUp("c1", "org1", "user1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns send result when customer is found", async () => {
    customersService.findById.mockResolvedValue({ id: "c1", businessId: "b1" });
    automationSend.sendPostVisitFollowup.mockResolvedValue({
      status: "skipped",
      reason: "toggle_off",
    });

    await expect(controller.sendFollowUp("c1", "org1", "user1")).resolves.toEqual({
      status: "skipped",
      reason: "toggle_off",
    });
    expect(automationSend.sendPostVisitFollowup).toHaveBeenCalledWith("org1", "b1", "c1", "user1");
  });
});
