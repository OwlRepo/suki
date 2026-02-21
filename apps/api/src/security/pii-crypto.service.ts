import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = "ENCv1:";

@Injectable()
export class PiiCryptoService {
  private readonly key: Buffer | null;

  constructor() {
    const raw = process.env.PII_ENCRYPTION_KEY_BASE64?.trim();
    if (!raw || raw.toLowerCase().includes("placeholder")) {
      this.key = null;
      return;
    }
    try {
      const buf = Buffer.from(raw, "base64");
      if (buf.length !== KEY_LENGTH) {
        this.key = null;
        return;
      }
      this.key = buf;
    } catch {
      this.key = null;
    }
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  /**
   * Encrypt plaintext. Returns prefixed base64 string or null if not configured.
   * Never log the input or output.
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null || plaintext === "") return null;
    if (!this.key) return plaintext;

    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      const enc = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([iv, tag, enc]);
      return PREFIX + combined.toString("base64");
    } catch {
      return null;
    }
  }

  /**
   * Decrypt ciphertext. Handles prefixed encrypted values or returns plaintext for legacy.
   * Never log the input or output.
   */
  decrypt(ciphertext: string | null | undefined): string | null {
    if (ciphertext == null || ciphertext === "") return null;
    if (!ciphertext.startsWith(PREFIX)) return ciphertext; // legacy plaintext
    if (!this.key) return null;

    try {
      const raw = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
      if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
      const iv = raw.subarray(0, IV_LENGTH);
      const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const enc = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(tag);
      return decipher.update(enc).toString("utf8") + decipher.final("utf8");
    } catch {
      return null;
    }
  }
}
