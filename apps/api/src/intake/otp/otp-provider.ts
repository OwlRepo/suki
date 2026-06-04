export type OtpProviderName = "twilio" | "semaphore";

export interface SendOtpInput {
  mobile: string;
}

export interface SendOtpResult {
  ok: boolean;
  provider: OtpProviderName;
  providerMessageId?: string;
  errorCode?: string;
  transient?: boolean;
  safeToRetry?: boolean;
  failoverEligible?: boolean;
  providerMetadata?: Record<string, unknown>;
  codeHash?: string;
  codeExpiresAt?: Date;
}

export interface VerifyOtpInput {
  mobile: string;
  code: string;
  storedCodeHash?: string | null;
  codeExpiresAt?: Date | null;
}

export interface VerifyOtpResult {
  valid: boolean;
  provider: OtpProviderName;
  errorCode?: string;
}

export interface IOtpProvider {
  send(input: SendOtpInput): Promise<SendOtpResult>;
  verify(input: VerifyOtpInput): Promise<VerifyOtpResult>;
}
