import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq } from "drizzle-orm";
import { CustomerTemplatesService } from "../customers/customer-templates.service";

@Controller("intake")
export class IntakeController {
  constructor(private readonly templatesService: CustomerTemplatesService) {}

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
    const [c] = await db
      .insert(customers)
      .values({
        businessId: body.businessId,
        name: body.name.trim(),
        mobile: body.mobile?.trim() || null,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .returning();
    return { customer: c, success: true };
  }
}
