import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
  Headers,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { getDb } from "@tyvera/database";
import { customers, businesses, consentAuditLogs } from "@tyvera/database";
import { eq, or } from "drizzle-orm";
import { AuditLogService } from "../security/audit-log.service";
import { TwilioWebhookValidationService } from "./twilio-webhook-validation.service";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/** Normalize mobile to digits for matching (e.g. +639171234567 -> 639171234567) */
function normalizeMobile(m: string | null | undefined): string | null {
  if (!m || typeof m !== "string") return null;
  const digits = m.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Philippine: ensure 63 prefix
  if (digits.startsWith("0")) return "63" + digits.slice(1);
  if (!digits.startsWith("63")) return "63" + digits;
  return digits;
}

/** Check if message body indicates STOP (opt-out) */
function isStopMessage(body: string | null | undefined): boolean {
  if (!body || typeof body !== "string") return false;
  const t = body.trim().toUpperCase();
  return t === "STOP" || t === "STOPALL" || t === "UNSUBSCRIBE" || t === "END";
}

@Controller("messaging/inbound")
export class InboundSmsController {
  private readonly logger = new Logger(InboundSmsController.name);

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly twilioValidation: TwilioWebhookValidationService,
  ) {}

  /**
   * Provider callback for inbound SMS. When user sends STOP, opt out immediately.
   * Accepts: { from: string, body?: string } (provider-agnostic).
   * Also supports Semaphore-style: { from: string, message?: string }.
   */
  @Post("sms")
  async handleInboundSms(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Headers("x-twilio-signature") signature: string | undefined,
    @Res() res: Response,
  ) {
    this.twilioValidation.validate({
      params: body,
      signature,
      configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
      request: req,
    });

    const from = (body?.from ?? body?.From) as string | undefined;
    const text = (body?.body ?? body?.message ?? body?.Body) as string | undefined;
    if (!from) throw new BadRequestException("Missing 'from'");

    if (!isStopMessage(text)) {
      this.logger.debug(`Inbound SMS from ${from} (not STOP), ignoring`);
      return this.sendEmptyTwiml(res);
    }

    const normalized = normalizeMobile(from);
    if (!normalized) {
      this.logger.warn(`Could not normalize mobile: ${from}`);
      return this.sendEmptyTwiml(res);
    }

    const db = getDb();
    const last10 = normalized.slice(-10);
    const localFormat = "0" + last10;
    const intlFormat = "+" + normalized;
    const matches = await db
      .select({
        id: customers.id,
        organizationId: businesses.organizationId,
        smsOptedOutAt: customers.smsOptedOutAt,
      })
      .from(customers)
      .innerJoin(businesses, eq(customers.businessId, businesses.id))
      .where(
        or(
          eq(customers.mobile, normalized),
          eq(customers.mobile, localFormat),
          eq(customers.mobile, intlFormat),
        )!,
      );

    const now = new Date();
    for (const c of matches) {
      if (c.smsOptedOutAt) continue; // already opted out
      await db
        .update(customers)
        .set({ smsOptedOutAt: now, updatedAt: now })
        .where(eq(customers.id, c.id));
      await db.insert(consentAuditLogs).values({
        customerId: c.id,
        channel: "sms",
        purpose: "transactional",
        before: "opted_in",
        after: "opted_out",
        source: "inbound_stop_webhook",
        actorUserId: null,
      });
      await this.auditLog.log({
        organizationId: c.organizationId,
        action: "consent_change",
        entity: "customer",
        entityId: c.id,
        details: { channel: "sms", change: "opted_out", source: "inbound_stop" },
      });
      this.logger.log(`SMS opt-out applied for customer ${c.id}`);
    }

    return this.sendEmptyTwiml(res);
  }

  private sendEmptyTwiml(res: Response) {
    return res.type("text/xml").send(EMPTY_TWIML);
  }
}
