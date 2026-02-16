import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { PromosService } from "./promos.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("promos")
@UseGuards(ClerkAuthGuard)
export class PromosController {
  constructor(private readonly promosService: PromosService) {}

  @Get()
  async list(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const list = await this.promosService.list(businessId, orgId);
    return { promos: list };
  }

  @Post()
  async create(
    @Body()
    body: {
      businessId: string;
      type: string;
      value?: string;
      validityStart: string;
      validityEnd: string;
      messageContent?: string;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.type || !orgId) {
      throw new BadRequestException("businessId and type required");
    }
    const promo = await this.promosService.create(body.businessId, orgId, {
      type: body.type,
      value: body.value,
      validityStart: new Date(body.validityStart),
      validityEnd: new Date(body.validityEnd),
      messageContent: body.messageContent,
    });
    return { promo };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const promo = await this.promosService.findById(id, orgId);
    return { promo };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    body: {
      type?: string;
      value?: string;
      validityStart?: string;
      validityEnd?: string;
      messageContent?: string;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const promo = await this.promosService.update(id, orgId, {
      type: body.type,
      value: body.value,
      validityStart: body.validityStart ? new Date(body.validityStart) : undefined,
      validityEnd: body.validityEnd ? new Date(body.validityEnd) : undefined,
      messageContent: body.messageContent,
    });
    return { promo };
  }

  @Patch(":id/send")
  async send(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const promo = await this.promosService.updateStatus(id, orgId, "sent");
    return { promo, message: "Marked as sent (demo mode - no actual message sent)" };
  }
}
