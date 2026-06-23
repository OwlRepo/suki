import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { getDb } from "@tyvera/database";
import { businesses } from "@tyvera/database";
import { eq } from "drizzle-orm";
import { CustomerTemplatesService } from "../customers/customer-templates.service";
import { CustomersService } from "../customers/customers.service";
import { IntakeBookingService } from "./intake-booking.service";
import {
  PH_MOBILE_E164_ERROR,
  normalizePhilippineMobileE164,
} from "@tyvera/types";

@Controller("intake")
export class IntakeController {
  constructor(
    private readonly templatesService: CustomerTemplatesService,
    private readonly bookingService: IntakeBookingService,
    private readonly customersService: CustomersService,
  ) {}

  @Get("config")
  async getConfig(@Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId required");
    }
    try {
      const db = getDb();
      const [business] = await db
        .select({
          name: businesses.name,
          businessType: businesses.businessType,
          brandColor: businesses.brandColor,
          logoUrl: businesses.logoUrl,
          tagline: businesses.tagline,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
      const { template } = await this.templatesService.getDefaultTemplateForIntake(businessId);
      return {
        template: template
          ? { id: template.id, name: template.name, fieldsConfig: template.fieldsConfig }
          : null,
        business: business
          ? {
              name: business.name,
              businessType: business.businessType,
              brandColor: business.brandColor,
              logoUrl: business.logoUrl,
              tagline: business.tagline,
            }
          : null,
      };
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
    const mobile = this.normalizeOptionalMobile(body.mobile);

    const customer = await this.customersService.resolveForPublicIntake(
      body.businessId,
      {
        name: body.name,
        mobile,
        email: body.email,
        notes: mergedNotes ?? undefined,
      },
    );

    return { customer, success: true };
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
    const mobile = normalizePhilippineMobileE164(body.mobile);
    if (!mobile) throw new BadRequestException(PH_MOBILE_E164_ERROR);
    const hold = await this.bookingService.createHold({ ...body, mobile });
    return { hold, success: true };
  }

  @Post("otp/send")
  async sendOtp(@Body() body: { holdId: string }, @Req() req: Request) {
    if (!body.holdId?.trim()) {
      throw new BadRequestException("holdId required");
    }
    const forwardedFor = req.headers["x-forwarded-for"];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : req.ip;
    return this.bookingService.sendOtp(body.holdId, clientIp);
  }

  @Post("otp/verify")
  async verifyOtp(@Body() body: { holdId: string; code: string }) {
    if (!body.holdId?.trim() || !body.code?.trim()) {
      throw new BadRequestException("holdId and code required");
    }
    return this.bookingService.verifyAndConfirm(body.holdId, body.code);
  }

  private normalizeOptionalMobile(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (!value.trim()) return undefined;
    const normalized = normalizePhilippineMobileE164(value);
    if (!normalized) throw new BadRequestException(PH_MOBILE_E164_ERROR);
    return normalized;
  }
}
