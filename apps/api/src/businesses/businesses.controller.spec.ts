import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessesController } from "./businesses.controller";

describe("BusinessesController update branding", () => {
  const businessesService = {
    listByOrganization: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    updateCrmMode: vi.fn(),
  };
  const featureFlags = {
    crmModeToggleEnabled: vi.fn(),
  };

  let controller: BusinessesController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new BusinessesController(
      businessesService as never,
      featureFlags as never,
    );
    businessesService.findById.mockResolvedValue({
      id: "biz-1",
      organizationId: "org-1",
    });
    businessesService.update.mockResolvedValue({
      id: "biz-1",
      organizationId: "org-1",
    });
  });

  it("whitelists branding fields and trims tagline", async () => {
    await controller.update("biz-1", "org-1", {
      name: " North Star ",
      brandColor: "#EEFF00",
      logoUrl: "data:image/png;base64,AAA",
      tagline: "  Sharp cuts, zero drift.  ",
      notAllowed: "nope",
    } as never);

    expect(businessesService.update).toHaveBeenCalledWith("biz-1", {
      name: "North Star",
      brandColor: "#EEFF00",
      logoUrl: "data:image/png;base64,AAA",
      tagline: "Sharp cuts, zero drift.",
    });
  });

  it("allows empty branding values to clear saved config", async () => {
    await controller.update("biz-1", "org-1", {
      brandColor: "",
      logoUrl: "",
      tagline: "",
    });

    expect(businessesService.update).toHaveBeenCalledWith("biz-1", {
      brandColor: null,
      logoUrl: null,
      tagline: null,
    });
  });

  it("rejects invalid brand colors", async () => {
    await expect(
      controller.update("biz-1", "org-1", {
        brandColor: "#GGGGGG",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(businessesService.update).not.toHaveBeenCalled();
  });

  it("rejects non-data-url logos and long taglines", async () => {
    await expect(
      controller.update("biz-1", "org-1", {
        logoUrl: "https://example.com/logo.png",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.update("biz-1", "org-1", {
        tagline: "x".repeat(81),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects updates for other organizations", async () => {
    businessesService.findById.mockResolvedValue({
      id: "biz-1",
      organizationId: "org-2",
    });

    await expect(
      controller.update("biz-1", "org-1", {
        brandColor: "#112233",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
