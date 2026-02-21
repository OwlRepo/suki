import { describe, it, expect, beforeEach } from "vitest";
import * as crypto from "crypto";
import { verifyLicense, parseLicenseClaims, validateClaims } from "./verify-license";

describe("verifyLicense", () => {
  let keyPair: { publicKey: string; privateKey: string };

  beforeEach(() => {
    keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  });

  it("verifies valid signature", () => {
    const payload = JSON.stringify({ organizationId: "org1", plan: "growth" });
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(payload);
    sign.end();
    const signature = sign.sign(keyPair.privateKey, "base64");
    expect(verifyLicense(payload, signature, keyPair.publicKey)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const payload = JSON.stringify({ organizationId: "org1" });
    expect(verifyLicense(payload, "invalid-signature", keyPair.publicKey)).toBe(false);
  });

  it("rejects tampered payload", () => {
    const payload = JSON.stringify({ organizationId: "org1" });
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(payload);
    sign.end();
    const signature = sign.sign(keyPair.privateKey, "base64");
    const tampered = JSON.stringify({ organizationId: "org2" });
    expect(verifyLicense(tampered, signature, keyPair.publicKey)).toBe(false);
  });
});

describe("parseLicenseClaims", () => {
  it("parses valid JSON claims", () => {
    const claims = {
      organizationId: "org1",
      plan: "growth",
      seats: 5,
      expiresAt: "2030-12-31",
      features: ["crm"],
    };
    const parsed = parseLicenseClaims(JSON.stringify(claims));
    expect(parsed).toEqual(claims);
  });

  it("returns null for invalid JSON", () => {
    expect(parseLicenseClaims("not json")).toBeNull();
    expect(parseLicenseClaims("{")).toBeNull();
  });
});

describe("validateClaims", () => {
  it("validates complete claims", () => {
    const result = validateClaims({
      organizationId: "org1",
      plan: "growth",
      seats: 5,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      features: [],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects expired license", () => {
    const result = validateClaims({
      organizationId: "org1",
      plan: "growth",
      seats: 5,
      expiresAt: "2020-01-01",
      features: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("rejects missing required claims", () => {
    const result = validateClaims({
      organizationId: "",
      plan: "growth",
      seats: 5,
      expiresAt: "2030-12-31",
      features: [],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid seat count", () => {
    const result = validateClaims({
      organizationId: "org1",
      plan: "growth",
      seats: 0,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      features: [],
    });
    expect(result.valid).toBe(false);
  });
});
