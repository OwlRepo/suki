import * as crypto from "crypto";

/**
 * Secure update channel - verifies signed metadata and artifact hashes.
 * TUF-style: verify metadata signature before trusting artifact.
 */
export interface UpdateMetadata {
  version: string;
  artifactUrl: string;
  artifactSha256: string;
  releasedAt: string;
}

export function verifyUpdateMetadata(
  metadataJson: string,
  signature: string,
  publicKey: string,
): { valid: boolean; metadata?: UpdateMetadata } {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(metadataJson);
    verifier.end();
    const sigBuf = Buffer.from(signature, "base64");
    if (!verifier.verify(publicKey, sigBuf)) {
      return { valid: false };
    }
    const metadata = JSON.parse(metadataJson) as UpdateMetadata;
    if (!metadata.version || !metadata.artifactSha256) {
      return { valid: false };
    }
    return { valid: true, metadata };
  } catch {
    return { valid: false };
  }
}

export function verifyArtifactHash(artifactBuffer: Buffer, expectedSha256: string): boolean {
  const hash = crypto.createHash("sha256").update(artifactBuffer).digest("hex");
  const hashBuf = Buffer.from(hash, "hex");
  const expectedBuf = Buffer.from(expectedSha256.toLowerCase(), "hex");
  if (hashBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, expectedBuf);
}
