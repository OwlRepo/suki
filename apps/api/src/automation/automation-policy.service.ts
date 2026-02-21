import { Injectable } from "@nestjs/common";

export interface CanSendResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class AutomationPolicyService {
  canSend(
    customer: {
      mobile?: string | null;
      email?: string | null;
      smsOptedOutAt?: Date | string | null;
      allowTransactionalSms?: string | boolean | null;
      allowPromotionalSms?: string | boolean | null;
      emailOptedOutAt?: Date | string | null;
      allowTransactionalEmail?: string | boolean | null;
      allowPromotionalEmail?: string | boolean | null;
    },
    purpose: "transactional" | "promotional",
    channel: "sms" | "email",
  ): CanSendResult {
    if (channel === "sms") {
      if (customer.smsOptedOutAt) {
        return { allowed: false, reason: "sms_opted_out" };
      }
      const mobile = customer.mobile?.trim();
      if (!mobile || mobile.length < 10) {
        return { allowed: false, reason: "missing_mobile" };
      }
      if (purpose === "transactional") {
        const allow = customer.allowTransactionalSms;
        if (allow === false || allow === "false") {
          return { allowed: false, reason: "transactional_consent_denied" };
        }
      }
      if (purpose === "promotional") {
        const allow = customer.allowPromotionalSms;
        if (allow === false || allow === "false") {
          return { allowed: false, reason: "promotional_consent_denied" };
        }
      }
    } else {
      if (customer.emailOptedOutAt) {
        return { allowed: false, reason: "email_opted_out" };
      }
      const email = customer.email?.trim();
      if (!email || !email.includes("@")) {
        return { allowed: false, reason: "missing_email" };
      }
      if (purpose === "transactional") {
        const allow = customer.allowTransactionalEmail;
        if (allow === false || allow === "false") {
          return { allowed: false, reason: "transactional_consent_denied" };
        }
      }
      if (purpose === "promotional") {
        const allow = customer.allowPromotionalEmail;
        if (allow === false || allow === "false") {
          return { allowed: false, reason: "promotional_consent_denied" };
        }
      }
    }

    return { allowed: true };
  }
}
