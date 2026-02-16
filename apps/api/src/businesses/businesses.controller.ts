import {
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
import { Tenant } from "../common/tenant.decorator";

@Controller("businesses")
@UseGuards(ClerkAuthGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  async list(@Tenant("organizationId") orgId: string) {
    const list = await this.businessesService.listByOrganization(orgId);
    return { businesses: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Body() body: { name: string; businessType: string },
  ) {
    if (!body.name?.trim() || !body.businessType?.trim()) {
      throw new ForbiddenException("name and businessType are required");
    }
    const business = await this.businessesService.create(orgId, {
      name: body.name.trim(),
      businessType: body.businessType.trim(),
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
    @Body() body: { name?: string; businessType?: string },
  ) {
    const business = await this.businessesService.findById(id);
    if (!business || business.organizationId !== orgId) {
      throw new ForbiddenException("Business not found");
    }
    const updated = await this.businessesService.update(id, body);
    return { business: updated };
  }
}
