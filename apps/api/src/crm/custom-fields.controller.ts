import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { CrmModeGuard } from "../common/crm-mode.guard";
import { CustomFieldsService } from "./custom-fields.service";

@Controller("crm/custom-fields")
@UseGuards(ClerkAuthGuard, CrmModeGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  async list(
    @Tenant("organizationId") orgId: string,
    @Query("businessId") businessId: string,
    @Query("entityType") entityType?: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const list = await this.customFieldsService.list(businessId, orgId!, entityType);
    return { customFields: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Body() body: {
      businessId: string;
      entityType: string;
      fieldName: string;
      fieldType?: string;
      sortOrder?: number;
    },
  ) {
    const field = await this.customFieldsService.create(orgId!, body);
    return { customField: field };
  }
}
