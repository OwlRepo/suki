import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { BusinessesService } from "./businesses.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { BillingWriteGuard } from "../common/billing-write.guard";
import { Tenant } from "../common/tenant.decorator";
import { FeatureFlagsService } from "../common/feature-flags.service";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/i;

@Controller("businesses")
@UseGuards(ClerkAuthGuard, BillingWriteGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get()
  async list(@Tenant("organizationId") orgId: string) {
    const list = await this.businessesService.listByOrganization(orgId);
    return { businesses: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Body() body: { name: string; businessType: string; workflowProfile?: string },
  ) {
    if (!body.name?.trim() || !body.businessType?.trim()) {
      throw new ForbiddenException("name and businessType are required");
    }
    const business = await this.businessesService.create(orgId, {
      name: body.name.trim(),
      businessType: body.businessType.trim(),
      workflowProfile: body.workflowProfile,
    });
    return { business };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId: string) {
    const business = await this.businessesService.findById(id);
    if (!business || business.organizationId !== orgId) {
      throw new ForbiddenException("Business not found");
    }
    return { business };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Tenant("organizationId") orgId: string,
    @Body()
    body: {
      name?: string;
      businessType?: string;
      brandColor?: string | null;
      logoUrl?: string | null;
      tagline?: string | null;
    },
  ) {
    const business = await this.businessesService.findById(id);
    if (!business || business.organizationId !== orgId) {
      throw new ForbiddenException("Business not found");
    }
    const patch = this.buildUpdatePatch(body);
    const updated = await this.businessesService.update(id, patch);
    return { business: updated };
  }

  @Patch(":id/crm-mode")
  async updateCrmMode(
    @Param("id") id: string,
    @Tenant("organizationId") orgId: string,
    @Body() body: { crmMode: "lite" | "full" },
  ) {
    if (!this.featureFlags.crmModeToggleEnabled()) {
      throw new ForbiddenException("CRM mode toggle is not enabled");
    }
    if (!body.crmMode || !["lite", "full"].includes(body.crmMode)) {
      throw new ForbiddenException("crmMode must be 'lite' or 'full'");
    }
    const updated = await this.businessesService.updateCrmMode(
      id,
      orgId,
      body.crmMode,
    );
    return { business: updated };
  }

  private buildUpdatePatch(body: {
    name?: string;
    businessType?: string;
    brandColor?: string | null;
    logoUrl?: string | null;
    tagline?: string | null;
  }) {
    const patch: {
      name?: string;
      businessType?: string;
      brandColor?: string | null;
      logoUrl?: string | null;
      tagline?: string | null;
    } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      patch.name = body.name.trim();
    }

    if (typeof body.businessType === "string" && body.businessType.trim()) {
      patch.businessType = body.businessType.trim();
    }

    if (body.brandColor !== undefined) {
      if (
        body.brandColor === null ||
        (typeof body.brandColor === "string" && body.brandColor.trim() === "")
      ) {
        patch.brandColor = null;
      } else if (
        typeof body.brandColor === "string" &&
        HEX_COLOR_PATTERN.test(body.brandColor.trim())
      ) {
        patch.brandColor = body.brandColor.trim();
      } else {
        throw new BadRequestException("brandColor must be a valid #RRGGBB value");
      }
    }

    if (body.logoUrl !== undefined) {
      if (
        body.logoUrl === null ||
        (typeof body.logoUrl === "string" && body.logoUrl.trim() === "")
      ) {
        patch.logoUrl = null;
      } else if (
        typeof body.logoUrl === "string" &&
        DATA_URL_PATTERN.test(body.logoUrl) &&
        body.logoUrl.length <= 120000
      ) {
        patch.logoUrl = body.logoUrl;
      } else {
        throw new BadRequestException(
          "logoUrl must be a PNG, JPEG, or WebP data URL under 120000 characters",
        );
      }
    }

    if (body.tagline !== undefined) {
      if (
        body.tagline === null ||
        (typeof body.tagline === "string" && body.tagline.trim() === "")
      ) {
        patch.tagline = null;
      } else if (typeof body.tagline === "string") {
        const tagline = body.tagline.trim();
        if (tagline.length > 80) {
          throw new BadRequestException("tagline must be 80 characters or fewer");
        }
        patch.tagline = tagline;
      } else {
        throw new BadRequestException("tagline must be a string");
      }
    }

    return patch;
  }
}
