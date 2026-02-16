import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("customers")
@UseGuards(ClerkAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(
    @Query("businessId") businessId: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.customersService.list(businessId, orgId, {
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post()
  async create(
    @Body() body: { businessId: string; name: string; mobile?: string; notes?: string; preferences?: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.name?.trim() || !orgId) {
      throw new BadRequestException("businessId and name required");
    }
    const customer = await this.customersService.create(
      body.businessId,
      orgId,
      {
        name: body.name,
        mobile: body.mobile,
        notes: body.notes,
        preferences: body.preferences,
      },
    );
    return { customer };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.findById(id, orgId);
    if (!customer) return { customer: null };
    return { customer };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: { name?: string; mobile?: string; notes?: string; preferences?: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.update(id, orgId, body);
    return { customer };
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    await this.customersService.delete(id, orgId);
    return { success: true };
  }

  @Post(":id/visit")
  async stampVisit(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.stampVisit(id, orgId);
    return { customer };
  }
}
