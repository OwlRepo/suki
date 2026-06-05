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
import {
  PH_MOBILE_E164_ERROR,
  normalizePhilippineMobileE164,
} from "@tyvera/types";

type ManualAppointmentStatus =
  | "scheduled"
  | "completed"
  | "missed"
  | "cancelled";

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

  @Get("booking/availability")
  async bookingAvailability(
    @Query("businessId") businessId: string,
    @Query("month") month: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !month || !orgId) throw new BadRequestException("businessId and month required");
    return this.appointmentsService.getAvailabilityForBooking(businessId, orgId, month);
  }

  @Post("booking/hold")
  async bookingHold(
    @Body() body: { businessId: string; customerId: string; mobile: string; scheduledAt: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId || !body.businessId || !body.customerId || !body.mobile || !body.scheduledAt) {
      throw new BadRequestException("businessId, customerId, mobile, scheduledAt required");
    }
    const mobile = normalizePhilippineMobileE164(body.mobile);
    if (!mobile) throw new BadRequestException(PH_MOBILE_E164_ERROR);
    const hold = await this.appointmentsService.createHoldForBooking(orgId, { ...body, mobile });
    return { hold, success: true };
  }

  @Post("booking/otp/send")
  async bookingOtpSend(
    @Body() body: { holdId: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId || !body.holdId) throw new BadRequestException("holdId required");
    return this.appointmentsService.sendBookingOtp(orgId, body.holdId);
  }

  @Post("booking/otp/verify")
  async bookingOtpVerify(
    @Body() body: { holdId: string; code: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId || !body.holdId || !body.code) throw new BadRequestException("holdId and code required");
    return this.appointmentsService.verifyBookingOtp(orgId, body.holdId, body.code);
  }

  @Post("booking/pin")
  async bookingPinConfirm(
    @Body() body: { businessId: string; holdId: string; pin: string; reason: string; staffName?: string },
    @Tenant() tenant?: { organizationId: string; userId?: string; role?: "owner" | "staff" },
  ) {
    if (!tenant?.organizationId || !tenant.userId || !tenant.role) {
      throw new UnauthorizedException("Unauthorized");
    }
    if (!body.businessId || !body.holdId || !body.pin || !body.reason) {
      throw new BadRequestException("businessId, holdId, pin and reason required");
    }
    return this.appointmentsService.confirmWithPinOverride({
      holdId: body.holdId,
      businessId: body.businessId,
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      actorRole: tenant.role,
      pin: body.pin,
      reason: body.reason,
      staffName: body.staffName,
    });
  }


  @Get("booking/security")
  async getBookingSecurityStatus(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.appointmentsService.getBookingSecurityStatus(businessId, orgId);
  }

  @Post("booking/security/pin")
  async setBookingPin(
    @Body() body: { businessId: string; pin: string },
    @Tenant() tenant?: { organizationId: string; userId?: string; role?: "owner" | "staff" },
  ) {
    if (!tenant?.organizationId || !tenant.userId || !tenant.role) {
      throw new UnauthorizedException("Unauthorized");
    }
    if (!body.businessId || !body.pin) throw new BadRequestException("businessId and pin required");
    return this.appointmentsService.setOtpSkipPin({
      businessId: body.businessId,
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      actorRole: tenant.role,
      pin: body.pin,
    });
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

  @Get("needs-review")
  async listNeedsReview(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) {
      throw new BadRequestException("businessId required");
    }

    const appointments =
      await this.appointmentsService.listNeedsReview(businessId, orgId);

    return { appointments };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const appt = await this.appointmentsService.findById(id, orgId);
    return { appointment: appt };
  }

  @Patch(":id/arrive")
  async markArrived(
    @Param("id") id: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");

    const appointment = await this.appointmentsService.markArrived(id, orgId);

    return { appointment };
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
    @Body() body: { status: ManualAppointmentStatus },
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
