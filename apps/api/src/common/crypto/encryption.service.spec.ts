import { randomBytes } from "node:crypto";
import { EncryptionService } from "./encryption.service";

function makeService(): EncryptionService {
  const key = randomBytes(32).toString("base64");
  const config = { get: jest.fn(() => key) };
  const service = new EncryptionService(config as any);
  service.onModuleInit();
  return service;
}

describe("EncryptionService", () => {
  it("round-trips plaintext through encrypt/decrypt", () => {
    const service = makeService();
    const plaintext = "Аллергия на орехи и мёд";

    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const service = makeService();
    const a = service.encrypt("same value");
    const b = service.encrypt("same value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with a different key (authenticity check)", () => {
    const service = makeService();
    const other = makeService();
    const encrypted = service.encrypt("secret");

    expect(() => other.decrypt(encrypted)).toThrow();
  });

  it("passes through null/undefined via the nullable helpers", () => {
    const service = makeService();
    expect(service.encryptNullable(null)).toBeNull();
    expect(service.encryptNullable(undefined)).toBeNull();
    expect(service.decryptNullable(null)).toBeNull();

    const encrypted = service.encryptNullable("value");
    expect(service.decryptNullable(encrypted)).toBe("value");
  });

  it("rejects a key that isn't 32 bytes when decoded", () => {
    const config = { get: jest.fn(() => Buffer.from("too-short").toString("base64")) };
    const service = new EncryptionService(config as any);
    expect(() => service.onModuleInit()).toThrow(/32 bytes/);
  });
});
