import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { customers, businesses } from "@tyvera/database";
import { eq } from "drizzle-orm";
import { CustomerTemplatesService } from "../customers/customer-templates.service";
import { IntakeBookingService } from "./intake-booking.service";

@Controller("intake")
export class IntakeController {
  constructor(
    private readonly templatesService: CustomerTemplatesService,
    private readonly bookingService: IntakeBookingService,
  ) {}

  @Get("config")
  async getConfig(@Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId required");
    }
    try {
      const { template } = await this.templatesService.getDefaultTemplateForIntake(businessId);
      return { template: template ? { id: template.id, name: template.name, fieldsConfig: template.fieldsConfig } : null };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new BadRequestException("Failed to load config");
    }
  }

  @Post()
  async submit(
    @Body()
    body: {
      businessId: string;
      name: string;
      mobile?: string;
      email?: string;
      notes?: string;
      source?: string;
    },
  ) {
    if (!body.businessId || !body.name?.trim()) {
      throw new BadRequestException("businessId and name required");
    }
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, body.businessId))
      .limit(1);
    if (!biz) {
      throw new BadRequestException("Business not found");
    }
    const source = body.source?.trim();
    const sourceLine = source ? `Lead source: ${source}` : "";
    const mergedNotes = [sourceLine, body.notes?.trim() ?? ""].filter(Boolean).join("\n\n") || null;

    const [c] = await db
      .insert(customers)
      .values({
        businessId: body.businessId,
        name: body.name.trim(),
        mobile: body.mobile?.trim() || null,
        email: body.email?.trim() || null,
        notes: mergedNotes,
      })
      .returning();
    return { customer: c, success: true };
  }

  @Get("availability")
  async availability(
    @Query("businessId") businessId: string,
    @Query("month") month: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId required");
    }
    if (!month?.trim()) {
      throw new BadRequestException("month required");
    }
    return this.bookingService.getAvailability(businessId, month);
  }

  @Post("hold")
  async hold(
    @Body()
    body: {
      businessId: string;
      customerId: string;
      mobile: string;
      scheduledAt: string;
    },
  ) {
    if (!body.businessId || !body.customerId || !body.mobile || !body.scheduledAt) {
      throw new BadRequestException("businessId, customerId, mobile, scheduledAt required");
    }
    const hold = await this.bookingService.createHold(body);
    return { hold, success: true };
  }

  @Post("otp/send")
  async sendOtp(@Body() body: { holdId: string }) {
    if (!body.holdId?.trim()) {
      throw new BadRequestException("holdId required");
    }
    return this.bookingService.sendOtp(body.holdId);
  }

  @Post("otp/verify")
  async verifyOtp(@Body() body: { holdId: string; code: string }) {
    if (!body.holdId?.trim() || !body.code?.trim()) {
      throw new BadRequestException("holdId and code required");
    }
    return this.bookingService.verifyAndConfirm(body.holdId, body.code);
  }
}
