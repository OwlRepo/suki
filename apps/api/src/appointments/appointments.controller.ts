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
import { AppointmentsService } from "./appointments.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("appointments")
@UseGuards(ClerkAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @Query("businessId") businessId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const list = await this.appointmentsService.list(businessId, orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return { appointments: list };
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
