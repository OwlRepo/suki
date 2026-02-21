/**
 * On-prem license verification.
 * Verifies detached RSA-SHA256 signature, parses claims, enforces expiry/entitlements.
 */
import * as crypto from "crypto";

export interface LicenseClaims {
  organizationId: string;
  plan: string;
  seats: number;
  expiresAt: string;
  features: string[];
}

export function verifyLicense(
  payload: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    const sigBuf = Buffer.from(signature, "base64");
    return verifier.verify(publicKey, sigBuf);
  } catch {
    return false;
  }
}

export function parseLicenseClaims(payload: string): LicenseClaims | null {
  try {
    return JSON.parse(payload) as LicenseClaims;
  } catch {
    return null;
  }
}

export function validateClaims(claims: LicenseClaims): { valid: boolean; reason?: string } {
  if (!claims.organizationId || !claims.plan || !claims.expiresAt) {
    return { valid: false, reason: "Missing required claims" };
  }
  const expires = new Date(claims.expiresAt);
  if (isNaN(expires.getTime()) || expires < new Date()) {
    return { valid: false, reason: "License expired" };
  }
  if (claims.seats < 1) {
    return { valid: false, reason: "Invalid seat count" };
  }
  return { valid: true };
}
