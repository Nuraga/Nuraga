import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes with argon2id and verifies the original plaintext", async () => {
    const hash = await service.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await service.verify(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await service.hash("correct horse battery staple");
    expect(await service.verify(hash, "wrong password")).toBe(false);
  });

  it("does not throw on a malformed hash, just returns false", async () => {
    expect(await service.verify("not-a-real-hash", "anything")).toBe(false);
  });
});
