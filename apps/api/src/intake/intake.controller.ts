import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq } from "drizzle-orm";

@Controller("intake")
export class IntakeController {
  @Post()
  async submit(@Body() body: { businessId: string; name: string; mobile?: string }) {
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
      })
      .returning();
    return { customer: c, success: true };
  }
}
