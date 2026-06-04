import { Injectable } from "@nestjs/common";
import {
  timingSafeEqual,
  randomBytes,
  randomInt,
  pbkdf2 as pbkdf2Callback,
} from "node:crypto";
import { promisify } from "node:util";
import type {
  IOtpProvider,
  SendOtpInput,
  SendOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "./otp-provider";

const SEMAPHORE_OTP_URL = "https://api.semaphore.co/api/v4/otp";
const OTP_TTL_MS = 5 * 60_000;
const HASH_PREFIX = "pbkdf2_sha256";
const pbkdf2 = promisify(pbkdf2Callback);

@Injectable()
export class SemaphoreOtpProvider implements IOtpProvider {
  private readonly apiKey: string | null;
  private readonly senderName: string | null;

  constructor() {
    const apiKey = process.env.SEMAPHORE_API_KEY?.trim() || null;
    const senderName = process.env.SEMAPHORE_SENDER_NAME?.trim() || null;
    this.apiKey =
      apiKey && !apiKey.toLowerCase().includes("placeholder") ? apiKey : null;
    this.senderName =
      senderName && !senderName.toLowerCase().includes("placeholder")
        ? senderName
        : null;
  }

  async send(input: SendOtpInput): Promise<SendOtpResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        provider: "semaphore",
        transient: false,
        safeToRetry: false,
        errorCode: "provider_not_configured",
      };
    }

    const code = this.generateCode();
    const codeHash = await hashOtp(code);
    const params = new URLSearchParams();
    params.set("apikey", this.apiKey);
    params.set("number", this.normalizeNumber(input.mobile));
    params.set("message", "Your TYVERA booking OTP is {otp}. It expires in 5 minutes.");
    params.set("code", code);
    if (this.senderName) {
      params.set("sendername", this.senderName);
    }

    try {
      const res = await fetch(SEMAPHORE_OTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const messageId =
        typeof data.message_id === "string" ? data.message_id : undefined;

      if (res.ok && messageId) {
        return {
          ok: true,
          provider: "semaphore",
          providerMessageId: messageId,
          codeHash,
          codeExpiresAt: new Date(Date.now() + OTP_TTL_MS),
          providerMetadata: data,
        };
      }

      if (res.status === 429 || res.status >= 500) {
        return {
          ok: false,
          provider: "semaphore",
          transient: true,
          safeToRetry: true,
          errorCode: "provider_transient_retryable",
          providerMetadata: data,
        };
      }

      return {
        ok: false,
        provider: "semaphore",
        transient: false,
        safeToRetry: false,
        errorCode: "provider_rejected",
        providerMetadata: data,
      };
    } catch {
      return {
        ok: false,
        provider: "semaphore",
        transient: true,
        safeToRetry: false,
        errorCode: "provider_outcome_unknown",
      };
    }
  }

  async verify(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    if (!input.storedCodeHash || !input.codeExpiresAt) {
      return {
        valid: false,
        provider: "semaphore",
        errorCode: "OTP_INVALID_CODE",
      };
    }
    if (input.codeExpiresAt.getTime() < Date.now()) {
      return {
        valid: false,
        provider: "semaphore",
        errorCode: "OTP_HOLD_EXPIRED",
      };
    }
    const valid = await verifyOtpHash(input.code.trim(), input.storedCodeHash);
    return valid
      ? { valid: true, provider: "semaphore" }
      : { valid: false, provider: "semaphore", errorCode: "OTP_INVALID_CODE" };
  }

  async hashCodeForTest(code: string): Promise<string> {
    return hashOtp(code);
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  private normalizeNumber(number: string): string {
    const trimmed = number.trim();
    return trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  }
}

export async function hashOtp(code: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 120_000;
  const hash = await pbkdf2(code, salt, iterations, 32, "sha256");
  return `${HASH_PREFIX}$${iterations}$${salt}$${hash.toString("base64url")}`;
}

export async function verifyOtpHash(code: string, storedHash: string): Promise<boolean> {
  const [prefix, iterationsRaw, salt, expectedRaw] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !iterationsRaw || !salt || !expectedRaw) {
    return false;
  }
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }
  const expected = Buffer.from(expectedRaw, "base64url");
  const actual = await pbkdf2(code, salt, iterations, expected.length, "sha256");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
