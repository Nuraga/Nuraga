import { authenticator } from "otplib";
import { TotpService } from "./totp.service";

describe("TotpService", () => {
  const service = new TotpService();

  it("generates a secret and verifies a code produced from it", () => {
    const secret = service.generateSecret();
    const code = authenticator.generate(secret);

    expect(service.verify(code, secret)).toBe(true);
  });

  it("rejects a code generated from a different secret", () => {
    const secret = service.generateSecret();
    const otherSecret = service.generateSecret();
    const code = authenticator.generate(otherSecret);

    expect(service.verify(code, secret)).toBe(false);
  });

  it("builds a otpauth:// URI containing the issuer and account label", () => {
    const secret = service.generateSecret();
    const uri = service.keyUri("owner@example.com", secret);

    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("owner@example.com"));
  });
});
