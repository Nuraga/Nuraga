import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Encrypts sensitive fields (child medical data) at rest per NFR 10.3.
// Payload layout: base64(iv[12] || authTag[16] || ciphertext).
@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>("FIELD_ENCRYPTION_KEY");
    if (!raw) throw new Error("FIELD_ENCRYPTION_KEY is not configured");

    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)");
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  }

  decrypt(payload: string): string {
    const raw = Buffer.from(payload, "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  encryptNullable(plaintext: string | null | undefined): string | null {
    return plaintext == null ? null : this.encrypt(plaintext);
  }

  decryptNullable(payload: string | null | undefined): string | null {
    return payload == null ? null : this.decrypt(payload);
  }
}
