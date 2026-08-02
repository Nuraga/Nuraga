import { randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { PasswordService } from "../auth/password.service";
import { TokenService } from "../auth/token.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { ProvisionDeviceDto } from "./dto/provision-device.dto";

const DEVICE_MANAGER_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

// secretHash is never returned to any client — these are the only fields a
// human-facing endpoint should ever see.
const PUBLIC_DEVICE_SELECT = {
  id: true,
  branchId: true,
  name: true,
  revokedAt: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

@Injectable()
export class DeviceAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** Заведующий/владелец creates a kiosk credential; the secret is shown exactly once. */
  async provision(user: AuthenticatedUser, branchId: string, dto: ProvisionDeviceDto) {
    this.branchScope.assertRoleInBranch(user, [...DEVICE_MANAGER_ROLES], branchId);

    const secret = randomBytes(24).toString("base64url");
    const secretHash = await this.password.hash(secret);

    const device = await this.prisma.device.create({
      data: { branchId, name: dto.name, secretHash },
      select: PUBLIC_DEVICE_SELECT,
    });
    await this.audit.record({
      entity: "device",
      entityId: device.id,
      action: "create",
      newValue: { name: device.name, branchId },
      actorId: user.id,
    });

    return { device, secret };
  }

  async listForBranch(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, [...DEVICE_MANAGER_ROLES], branchId);
    return this.prisma.device.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      select: PUBLIC_DEVICE_SELECT,
    });
  }

  async revoke(user: AuthenticatedUser, branchId: string, deviceId: string) {
    this.branchScope.assertRoleInBranch(user, [...DEVICE_MANAGER_ROLES], branchId);
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.branchId !== branchId) throw new NotFoundException("Device not found");

    await this.prisma.device.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
    await this.audit.record({
      entity: "device",
      entityId: deviceId,
      action: "update",
      newValue: { event: "revoke" },
      actorId: user.id,
    });
  }

  /**
   * Called once by the kiosk itself during physical setup — not a human
   * session, so no @CurrentUser()/JwtAuthGuard here; the secret (typed in by
   * whoever configures the tablet) is the only credential.
   */
  async pair(deviceId: string, secret: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.revokedAt) throw new UnauthorizedException("Unknown or revoked device");

    const secretOk = await this.password.verify(device.secretHash, secret);
    if (!secretOk) throw new UnauthorizedException("Invalid device secret");

    await this.prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });

    const accessToken = await this.tokens.signDeviceToken(device.id, device.branchId);
    return { accessToken, branchId: device.branchId, deviceName: device.name };
  }

  /** Used by DeviceAuthGuard on every request — a revoked device is rejected immediately, not just on next pairing. */
  async assertActive(deviceId: string, branchId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.revokedAt || device.branchId !== branchId) {
      throw new ForbiddenException("Device is not active");
    }
  }
}
