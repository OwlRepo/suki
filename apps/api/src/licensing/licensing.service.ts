import * as crypto from "crypto";
import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { licenseActivations, licenseChallenges } from "@suki/database";
import { eq, and } from "drizzle-orm";
import {
  verifyLicense,
  parseLicenseClaims,
  validateClaims,
  type LicenseClaims,
} from "./verify-license";

@Injectable()
export class LicensingService {
  async activateOnline(
    organizationId: string,
    payload: string,
    signature: string,
    publicKey: string,
    machineFingerprint?: string,
  ) {
    if (!verifyLicense(payload, signature, publicKey)) {
      throw new ForbiddenException("LICENSE_SIGNATURE_INVALID");
    }
    const claims = parseLicenseClaims(payload);
    if (!claims) throw new ForbiddenException("LICENSE_PARSE_FAILED");
    const validation = validateClaims(claims);
    if (!validation.valid) {
      throw new ForbiddenException(validation.reason ?? "LICENSE_INVALID");
    }
    if (claims.organizationId !== organizationId) {
      throw new ForbiddenException("LICENSE_ORG_MISMATCH");
    }
    const db = getDb();
    const existing = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.organizationId, organizationId),
          eq(licenseActivations.status, "active"),
        ),
      );
    if (existing.length >= claims.seats) {
      throw new ForbiddenException("LICENSE_SEAT_LIMIT_REACHED");
    }
    const [activation] = await db
      .insert(licenseActivations)
      .values({
        organizationId,
        machineFingerprint: machineFingerprint ?? null,
        licensePayload: payload,
        status: "active",
      })
      .returning();
    return { activationId: activation!.id, claims };
  }

  async attest(organizationId: string, activationId: string) {
    const db = getDb();
    const [act] = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.id, activationId),
          eq(licenseActivations.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!act || act.status !== "active") {
      throw new ForbiddenException("ACTIVATION_NOT_FOUND");
    }
    await db
      .update(licenseActivations)
      .set({ lastAttestationAt: new Date() })
      .where(eq(licenseActivations.id, activationId));
    const claims = parseLicenseClaims(act.licensePayload ?? "{}") as LicenseClaims | null;
    if (claims) {
      const validation = validateClaims(claims);
      if (!validation.valid) {
        await db
          .update(licenseActivations)
          .set({ status: "revoked" })
          .where(eq(licenseActivations.id, activationId));
        throw new ForbiddenException(validation.reason ?? "LICENSE_EXPIRED");
      }
    }
    return { status: "ok" };
  }

  async revoke(organizationId: string, activationId: string) {
    const db = getDb();
    const [act] = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.id, activationId),
          eq(licenseActivations.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!act) throw new ForbiddenException("ACTIVATION_NOT_FOUND");
    await db
      .update(licenseActivations)
      .set({ status: "revoked" })
      .where(eq(licenseActivations.id, activationId));
    return { revoked: true };
  }

  /** Offline activation: request a challenge (from a connected machine). */
  async createOfflineChallenge(organizationId: string, validMinutes = 120) {
    const db = getDb();
    const challenge = crypto.randomBytes(32).toString("hex");
    const validUntil = new Date(Date.now() + validMinutes * 60 * 1000);
    const [c] = await db
      .insert(licenseChallenges)
      .values({
        organizationId,
        challenge,
        validUntil,
      })
      .returning();
    return {
      challengeId: c!.id,
      challenge,
      validUntil: validUntil.toISOString(),
    };
  }

  /** Offline activation: redeem challenge + license, return signed activation blob for air-gapped machine. */
  async activateOffline(
    challengeId: string,
    challenge: string,
    payload: string,
    signature: string,
    publicKey: string,
    machineFingerprint?: string,
  ) {
    if (!verifyLicense(payload, signature, publicKey)) {
      throw new ForbiddenException("LICENSE_SIGNATURE_INVALID");
    }
    const claims = parseLicenseClaims(payload);
    if (!claims) throw new ForbiddenException("LICENSE_PARSE_FAILED");
    const validation = validateClaims(claims);
    if (!validation.valid) {
      throw new ForbiddenException(validation.reason ?? "LICENSE_INVALID");
    }

    const db = getDb();
    const [c] = await db
      .select()
      .from(licenseChallenges)
      .where(eq(licenseChallenges.id, challengeId))
      .limit(1);
    if (!c || c.challenge !== challenge) {
      throw new ForbiddenException("CHALLENGE_INVALID");
    }
    if (c.usedAt) {
      throw new ForbiddenException("CHALLENGE_ALREADY_USED");
    }
    if (new Date() > c.validUntil) {
      throw new ForbiddenException("CHALLENGE_EXPIRED");
    }
    if (c.organizationId !== claims.organizationId) {
      throw new ForbiddenException("CHALLENGE_ORG_MISMATCH");
    }

    const existing = await db
      .select()
      .from(licenseActivations)
      .where(
        and(
          eq(licenseActivations.organizationId, claims.organizationId),
          eq(licenseActivations.status, "active"),
        ),
      );
    if (existing.length >= claims.seats) {
      throw new ForbiddenException("LICENSE_SEAT_LIMIT_REACHED");
    }

    const [activation] = await db
      .insert(licenseActivations)
      .values({
        organizationId: claims.organizationId,
        machineFingerprint: machineFingerprint ?? null,
        licensePayload: payload,
        status: "active",
      })
      .returning();

    await db
      .update(licenseChallenges)
      .set({ usedAt: new Date() })
      .where(eq(licenseChallenges.id, challengeId));

    const responsePayload = JSON.stringify({
      activationId: activation!.id,
      organizationId: claims.organizationId,
      machineFingerprint: machineFingerprint ?? null,
      expiresAt: claims.expiresAt,
      issuedAt: new Date().toISOString(),
    });
    const signKey = process.env.LICENSE_SIGNING_PRIVATE_KEY;
    if (!signKey) {
      throw new ForbiddenException(
        "LICENSE_SIGNING_PRIVATE_KEY not configured. Offline activation requires server-side signing key.",
      );
    }
    const responseSignature = this.signPayload(responsePayload, signKey);

    return {
      activationId: activation!.id,
      responsePayload,
      responseSignature,
      claims,
    };
  }

  private signPayload(payload: string, privateKeyPem: string): string {
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(payload);
    sign.end();
    return sign.sign(privateKeyPem, "base64");
  }
}
