import { Injectable } from "@nestjs/common";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";

const ISSUER = "Детсад CRM";

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
