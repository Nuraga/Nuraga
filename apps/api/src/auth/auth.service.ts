import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { TotpService } from "./totp.service";

// Roles for which 2FA is mandatory per NFR 10.3.
const ROLES_REQUIRING_2FA: Role[] = ["OWNER", "ACCOUNTANT", "SUPERADMIN"];

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | { status: "mfa_required"; mfaToken: string }
  | ({ status: "ok"; totpSetupRequired: boolean } & TokenPair);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly audit: AuditService,
  ) {}

  async login(identifier: string, plainPassword: string, ip?: string): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: { branchRoles: true },
    });

    // Constant-shaped error regardless of which check failed, to avoid
    // leaking whether an identifier exists.
    const invalidCredentials = () => new UnauthorizedException("Invalid credentials");

    if (!user) throw invalidCredentials();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account temporarily locked. Try again later.");
    }

    const passwordOk = await this.password.verify(user.passwordHash, plainPassword);
    if (!passwordOk) {
      await this.registerFailedAttempt(user.id, user.failedLoginCount);
      throw invalidCredentials();
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    const requires2fa = user.branchRoles.some((g) => ROLES_REQUIRING_2FA.includes(g.role));

    if (requires2fa && user.totpEnabled) {
      const mfaToken = await this.tokens.signMfaToken(user.id);
      return { status: "mfa_required", mfaToken };
    }

    const pair = await this.issueTokenPair(user.id);
    await this.audit.record({
      entity: "user",
      entityId: user.id,
      action: "update",
      newValue: { event: "login" },
      actorId: user.id,
      ip,
    });

    return { status: "ok", totpSetupRequired: requires2fa && !user.totpEnabled, ...pair };
  }

  async verifyMfa(mfaToken: string, code: string): Promise<TokenPair> {
    let userId: string;
    try {
      userId = await this.tokens.verifyMfaToken(mfaToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired MFA challenge");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException("2FA not configured");
    }

    if (!this.totp.verify(code, user.totpSecret)) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    return this.issueTokenPair(user.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const rotated = await this.tokens.rotateRefreshToken(refreshToken);
    if (!rotated) throw new UnauthorizedException("Invalid refresh token");

    const accessToken = await this.tokens.signAccessToken(rotated.userId);
    return { accessToken, refreshToken: rotated.token };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
  }

  /**
   * Self-service password change — requires the current password (no
   * "forgot password" email flow exists yet, see DEPLOY.md). Revokes every
   * other session so a leaked old password stops working immediately.
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const oldPasswordOk = await this.password.verify(user.passwordHash, oldPassword);
    if (!oldPasswordOk) {
      throw new UnauthorizedException("Текущий пароль указан неверно");
    }

    const passwordHash = await this.password.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);

    await this.audit.record({
      entity: "user",
      entityId: userId,
      action: "update",
      newValue: { event: "password_changed" },
      actorId: userId,
    });
  }

  async setup2fa(userId: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = this.totp.generateSecret();

    // Stored but not yet trusted — totpEnabled flips only after enable2fa succeeds.
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });

    const label = user.email ?? user.phone ?? user.id;
    const otpauthUrl = this.totp.keyUri(label, secret);
    const qrCodeDataUrl = await this.totp.qrCodeDataUrl(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl };
  }

  async enable2fa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecret) {
      throw new UnauthorizedException("Call /auth/2fa/setup first");
    }
    if (!this.totp.verify(code, user.totpSecret)) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit.record({
      entity: "user",
      entityId: userId,
      action: "update",
      newValue: { event: "2fa_enabled" },
      actorId: userId,
    });
  }

  private async issueTokenPair(userId: string): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(userId),
      this.tokens.issueRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }

  private async registerFailedAttempt(userId: string, currentCount: number): Promise<void> {
    const nextCount = currentCount + 1;
    const lockedUntil =
      nextCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: lockedUntil ? 0 : nextCount,
        lockedUntil,
      },
    });
  }
}
