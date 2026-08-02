import { randomBytes, createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../common/prisma/prisma.service";

export interface AccessTokenPayload {
  sub: string;
}

interface MfaTokenPayload {
  sub: string;
  purpose: "mfa";
}

interface DeviceTokenPayload {
  sub: string;
  branchId: string;
  purpose: "device";
}

interface CheckinTokenPayload {
  sub: string;
  branchId: string;
  purpose: "checkin";
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signAccessToken(userId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
    });
  }

  /** Short-lived token proving password-step success, pending a TOTP code. */
  async signMfaToken(userId: string): Promise<string> {
    const payload: MfaTokenPayload = { sub: userId, purpose: "mfa" };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: "5m",
    });
  }

  async verifyMfaToken(token: string): Promise<string> {
    const payload = await this.jwt.verifyAsync<MfaTokenPayload>(token, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
    });
    if (payload.purpose !== "mfa") throw new Error("Not an MFA token");
    return payload.sub;
  }

  /**
   * Long-lived session token for a kiosk Device (never a human User — see
   * schema.prisma comment above the Device model). A separate secret from
   * the human access token means a device token can never be accepted by
   * JwtAuthGuard even if some check forgot the `purpose` discriminator.
   */
  async signDeviceToken(deviceId: string, branchId: string): Promise<string> {
    const payload: DeviceTokenPayload = { sub: deviceId, branchId, purpose: "device" };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_DEVICE_SECRET"),
      expiresIn: this.config.get<string>("JWT_DEVICE_TTL") ?? "180d",
    });
  }

  async verifyDeviceToken(token: string): Promise<{ deviceId: string; branchId: string }> {
    const payload = await this.jwt.verifyAsync<DeviceTokenPayload>(token, {
      secret: this.config.get<string>("JWT_DEVICE_SECRET"),
    });
    if (payload.purpose !== "device") throw new Error("Not a device token");
    return { deviceId: payload.sub, branchId: payload.branchId };
  }

  /** ~45s token a staff member's "Мой QR" screen shows, scanned by a kiosk Device. */
  async signCheckinToken(staffId: string, branchId: string): Promise<string> {
    const payload: CheckinTokenPayload = { sub: staffId, branchId, purpose: "checkin" };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_CHECKIN_SECRET"),
      expiresIn: "45s",
    });
  }

  async verifyCheckinToken(token: string): Promise<{ staffId: string; branchId: string }> {
    const payload = await this.jwt.verifyAsync<CheckinTokenPayload>(token, {
      secret: this.config.get<string>("JWT_CHECKIN_SECRET"),
    });
    if (payload.purpose !== "checkin") throw new Error("Not a check-in token");
    return { staffId: payload.sub, branchId: payload.branchId };
  }

  /** Issues a new opaque refresh token, storing only its hash. */
  async issueRefreshToken(userId: string): Promise<string> {
    const plain = randomBytes(48).toString("base64url");
    const tokenHash = this.hashRefreshToken(plain);
    const ttlDays = this.refreshTtlDays();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return plain;
  }

  /** Validates a refresh token and rotates it (revokes old, issues new). */
  async rotateRefreshToken(plain: string): Promise<{ userId: string; token: string } | null> {
    const tokenHash = this.hashRefreshToken(plain);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return null;
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const next = await this.issueRefreshToken(record.userId);
    return { userId: record.userId, token: next };
  }

  async revokeRefreshToken(plain: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(plain);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashRefreshToken(plain: string): string {
    return createHash("sha256").update(plain).digest("hex");
  }

  private refreshTtlDays(): number {
    const raw = this.config.get<string>("JWT_REFRESH_TTL") ?? "30d";
    const match = /^(\d+)d$/.exec(raw);
    return match ? Number(match[1]) : 30;
  }
}
