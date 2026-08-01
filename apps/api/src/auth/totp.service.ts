import { Injectable } from "@nestjs/common";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";

const ISSUER = "Детсад CRM";

// otplib defaults to window: 0 — a code is only accepted within the exact
// same 30s step it was generated in, with zero tolerance for clock drift
// or the few seconds it takes a person to read and type a code. window: 1
// accepts the previous/current/next step (±30s), the standard tolerance
// used by real-world TOTP implementations (RFC 6238 §5.2).
authenticator.options = { window: 1 };

@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  keyUri(accountLabel: string, secret: string): string {
    return authenticator.keyuri(accountLabel, ISSUER, secret);
  }

  async qrCodeDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  verify(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
