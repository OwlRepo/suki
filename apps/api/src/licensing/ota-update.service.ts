import { Injectable } from "@nestjs/common";
import {
  verifyUpdateMetadata,
  verifyArtifactHash,
  type UpdateMetadata,
} from "./update-verification.service";

export type ReleaseChannel = "stable" | "beta" | "canary";

export interface OtaRelease {
  channel: ReleaseChannel;
  version: string;
  artifactUrl: string;
  artifactSha256: string;
  releasedAt: string;
}

@Injectable()
export class OtaUpdateService {
  /**
   * Verifies signed update metadata. TUF-style: verify metadata signature before trusting artifact.
   */
  verifyMetadata(
    metadataJson: string,
    signature: string,
    publicKey: string,
  ): { valid: boolean; metadata?: UpdateMetadata } {
    return verifyUpdateMetadata(metadataJson, signature, publicKey);
  }

  /**
   * Verifies artifact hash matches the signed metadata.
   */
  verifyArtifact(artifactBuffer: Buffer, expectedSha256: string): boolean {
    return verifyArtifactHash(artifactBuffer, expectedSha256);
  }

  /**
   * Returns available releases for a channel (from env or external store).
   * In production, this would fetch from a release server or CDN.
   */
  async getReleases(channel: ReleaseChannel): Promise<OtaRelease[]> {
    const baseUrl = process.env.OTA_ARTIFACT_BASE_URL;
    if (!baseUrl) return [];
    const version = process.env.OTA_CURRENT_VERSION ?? "1.0.0";
    return [
      {
        channel,
        version,
        artifactUrl: `${baseUrl}/releases/${channel}/${version}/artifact.tgz`,
        artifactSha256: "", // Would be populated from release manifest
        releasedAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Returns metadata + signature for the latest release on a channel.
   * Clients verify the signature with the bundled public key before applying.
   */
  async getUpdateManifest(channel: ReleaseChannel): Promise<{
    metadata: string;
    signature: string;
  } | null> {
    const releases = await this.getReleases(channel);
    const latest = releases[0];
    if (!latest) return null;
    const metadata = JSON.stringify({
      version: latest.version,
      artifactUrl: latest.artifactUrl,
      artifactSha256: latest.artifactSha256,
      releasedAt: latest.releasedAt,
    });
    const signKey = process.env.LICENSE_SIGNING_PRIVATE_KEY;
    if (!signKey) return null;
    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(metadata);
    sign.end();
    const signature = sign.sign(signKey, "base64");
    return { metadata, signature };
  }
}
