import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type {
  ClientBillingRequestKind,
  PlanType,
} from "@tyvera/types";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { OwnerGuard } from "../common/owner.guard";
import { Tenant } from "../common/tenant.decorator";
import { ClientBillingRequestService } from "./client-billing-request.service";

@Controller("billing/requests")
export class ClientBillingRequestController {
  constructor(
    private readonly clientBillingRequests: ClientBillingRequestService,
  ) {}

  @Post()
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  create(
    @Body()
    body: {
      kind: ClientBillingRequestKind;
      requestedPlanType?: PlanType | null;
      requestedSku?: string | null;
      requestedQuantity?: number | null;
      note?: string | null;
    },
    @Tenant("organizationId") organizationId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!organizationId || !userId) {
      throw new UnauthorizedException("Unauthorized");
    }
    return this.clientBillingRequests.create({
      organizationId,
      requestedByUserId: userId,
      ...body,
    });
  }

  @Get()
  @UseGuards(ClerkAuthGuard)
  async list(@Tenant("organizationId") organizationId?: string) {
    if (!organizationId) throw new UnauthorizedException("Unauthorized");
    return {
      clientBillingRequests:
        await this.clientBillingRequests.listForOrganization(organizationId),
    };
  }

  @Post(":id/cancel")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  cancel(
    @Param("id") requestId: string,
    @Tenant("organizationId") organizationId?: string,
  ) {
    if (!organizationId) throw new UnauthorizedException("Unauthorized");
    return this.clientBillingRequests.cancel(organizationId, requestId);
  }
}
