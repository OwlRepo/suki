import { Injectable } from "@nestjs/common";
import type {
  IOtpProvider,
  SendOtpInput,
  SendOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "./otp-provider";

type TwilioPayload = Record<string, unknown>;

@Injectable()
export class TwilioVerifyOtpProvider implements IOtpProvider {
  async send(input: SendOtpInput): Promise<SendOtpResult> {
    const config = this.getConfig();
    if (!config) {
      return this.notConfigured();
    }

    const params = new URLSearchParams();
    params.set("To", input.mobile);
    params.set("Channel", "sms");

    try {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${config.basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      const data = (await res.json().catch(() => ({}))) as TwilioPayload;
      const sid = typeof data.sid === "string" ? data.sid : undefined;

      if (res.ok && sid) {
        return {
          ok: true,
          provider: "twilio",
          providerMessageId: sid,
          providerMetadata: data,
        };
      }

      return this.mapFailure(res.status, data);
    } catch {
      return {
        ok: false,
        provider: "twilio",
        transient: true,
        safeToRetry: false,
        errorCode: "provider_outcome_unknown",
      };
    }
  }

  async verify(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const config = this.getConfig();
    if (!config) {
      return {
        valid: false,
        provider: "twilio",
        errorCode: "OTP_PROVIDER_UNAVAILABLE",
      };
    }

    const params = new URLSearchParams();
    params.set("To", input.mobile);
    params.set("Code", input.code.trim());

    try {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/VerificationCheck`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${config.basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      const data = (await res.json().catch(() => ({}))) as TwilioPayload;
      if (!res.ok) {
        return {
          valid: false,
          provider: "twilio",
          errorCode: "OTP_PROVIDER_UNAVAILABLE",
        };
      }
      return data.valid
        ? { valid: true, provider: "twilio" }
        : { valid: false, provider: "twilio", errorCode: "OTP_INVALID_CODE" };
    } catch {
      return {
        valid: false,
        provider: "twilio",
        errorCode: "OTP_PROVIDER_UNAVAILABLE",
      };
    }
  }

  private mapFailure(status: number, data: TwilioPayload): SendOtpResult {
    if (status === 429 || status >= 500) {
      return {
        ok: false,
        provider: "twilio",
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
        providerMetadata: data,
      };
    }

    const rawCode = data.code;
    const code =
      typeof rawCode === "string" || typeof rawCode === "number"
        ? String(rawCode)
        : "provider_rejected";
    return {
      ok: false,
      provider: "twilio",
      transient: false,
      safeToRetry: false,
      errorCode: code,
      failoverEligible: this.getFailoverErrorCodes().has(code),
      providerMetadata: data,
    };
  }

  private notConfigured(): SendOtpResult {
    return {
      ok: false,
      provider: "twilio",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_not_configured",
    };
  }

  private getConfig():
    | { verifyServiceSid: string; basicAuth: string }
    | null {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
    if (!sid || !token || !verifyServiceSid) return null;
    return {
      verifyServiceSid,
      basicAuth: Buffer.from(`${sid}:${token}`).toString("base64"),
    };
  }

  private getFailoverErrorCodes(): Set<string> {
    return new Set(
      (process.env.TWILIO_OTP_FAILOVER_ON_ERROR_CODES ?? "")
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    );
  }
}
