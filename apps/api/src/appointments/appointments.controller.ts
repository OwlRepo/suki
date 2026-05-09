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
import { AppointmentsService } from "./appointments.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { BillingWriteGuard } from "../common/billing-write.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("appointments")
@UseGuards(ClerkAuthGuard, BillingWriteGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @Query("businessId") businessId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) : undefined;
    const result = await this.appointmentsService.list(businessId, orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit && Number.isFinite(limit) ? limit : undefined,
      offset: offset && Number.isFinite(offset) ? offset : undefined,
    });
    if (Array.isArray(result)) {
      return { appointments: result };
    }
    return {
      appointments: result.items,
      total: result.total,
      hasMore: result.hasMore,
      limit: result.limit,
      offset: result.offset,
    };
  }

  @Post()
  async create(
    @Body()
    body: {
      businessId: string;
      customerId: string;
      scheduledAt: string;
      notes?: string;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.customerId || !body.scheduledAt || !orgId) {
      throw new BadRequestException("businessId, customerId, scheduledAt required");
    }
    const appt = await this.appointmentsService.create(
      body.businessId,
      orgId,
      {
        customerId: body.customerId,
        scheduledAt: new Date(body.scheduledAt),
        notes: body.notes,
      },
    );
    return { appointment: appt };
  }

  @Get("share-templates")
  async listShareTemplates(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const templates = await this.appointmentsService.listShareTemplates(businessId, orgId);
    return { templates };
  }

  @Post("share-templates")
  async createShareTemplate(
    @Body()
    body: {
      businessId: string;
      name: string;
      slots: string[];
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !orgId) throw new BadRequestException("businessId required");
    const template = await this.appointmentsService.createShareTemplate(body.businessId, orgId, {
      name: body.name,
      slots: body.slots ?? [],
    });
    return { template };
  }

  @Patch("share-templates/:id")
  async updateShareTemplate(
    @Param("id") id: string,
    @Body()
    body: {
      businessId: string;
      name?: string;
      slots?: string[];
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !orgId) throw new BadRequestException("businessId required");
    const template = await this.appointmentsService.updateShareTemplate(id, body.businessId, orgId, {
      name: body.name,
      slots: body.slots,
    });
    return { template };
  }

  @Delete("share-templates/:id")
  async deleteShareTemplate(
    @Param("id") id: string,
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const deleted = await this.appointmentsService.deleteShareTemplate(id, businessId, orgId);
    return { template: deleted, success: true };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const appt = await this.appointmentsService.findById(id, orgId);
    return { appointment: appt };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    body: { scheduledAt?: string; notes?: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const appt = await this.appointmentsService.update(id, orgId, {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      notes: body.notes,
    });
    return { appointment: appt };
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: "scheduled" | "completed" | "missed" | "cancelled" },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId || !body.status) throw new BadRequestException("status required");
    const appt = await this.appointmentsService.updateStatus(id, orgId, body.status);
    return { appointment: appt };
  }

  @Patch(":id/reminder-sent")
  async markReminderSent(
    @Param("id") id: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const appt = await this.appointmentsService.markReminderSent(id, orgId);
    return { appointment: appt, message: "Reminder marked as sent" };
  }
}
