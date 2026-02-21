import { describe, it, expect, beforeEach } from "vitest";
import * as crypto from "crypto";
import {
  verifyUpdateMetadata,
  verifyArtifactHash,
  type UpdateMetadata,
} from "./update-verification.service";

describe("update-verification", () => {
  let keyPair: { publicKey: string; privateKey: string };

  beforeEach(() => {
    keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  });

  describe("verifyUpdateMetadata", () => {
    it("verifies valid signed metadata", () => {
      const metadata: UpdateMetadata = {
        version: "1.2.3",
        artifactUrl: "https://example.com/1.2.3.tgz",
        artifactSha256: "abc123",
        releasedAt: new Date().toISOString(),
      };
      const metadataJson = JSON.stringify(metadata);
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(metadataJson);
      sign.end();
      const signature = sign.sign(keyPair.privateKey, "base64");

      const result = verifyUpdateMetadata(metadataJson, signature, keyPair.publicKey);
      expect(result.valid).toBe(true);
      expect(result.metadata).toEqual(metadata);
    });

    it("rejects invalid signature", () => {
      const metadataJson = JSON.stringify({
        version: "1.0",
        artifactSha256: "abc",
        releasedAt: new Date().toISOString(),
      });
      expect(
        verifyUpdateMetadata(metadataJson, "invalid-sig", keyPair.publicKey),
      ).toEqual({ valid: false });
    });

    it("rejects metadata missing version", () => {
      const metadataJson = JSON.stringify({
        artifactUrl: "x",
        artifactSha256: "abc",
        releasedAt: new Date().toISOString(),
      });
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(metadataJson);
      sign.end();
      const signature = sign.sign(keyPair.privateKey, "base64");
      const result = verifyUpdateMetadata(metadataJson, signature, keyPair.publicKey);
      expect(result.valid).toBe(false);
    });
  });

  describe("verifyArtifactHash", () => {
    it("verifies matching SHA256", () => {
      const data = Buffer.from("test content");
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      expect(verifyArtifactHash(data, hash)).toBe(true);
    });

    it("rejects mismatched hash", () => {
      const data = Buffer.from("test content");
      expect(verifyArtifactHash(data, "0".repeat(64))).toBe(false);
    });
  });
});
