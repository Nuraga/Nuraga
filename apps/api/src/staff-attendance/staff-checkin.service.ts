import { Injectable, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TokenService } from "../auth/token.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const CHECKIN_TOKEN_TTL_MS = 45_000;

@Injectable()
export class StaffCheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly tokens: TokenService,
  ) {}

  /** Any authenticated staff member can fetch a rotating QR for themselves — it's never someone else's data. */
  async issueToken(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);

    const staff = await this.prisma.staff.findFirst({ where: { userId: user.id, branchId } });
    if (!staff) throw new NotFoundException("No staff record for this user in this branch");

    const token = await this.tokens.signCheckinToken(staff.id, branchId);
    const qrCodeDataUrl = await QRCode.toDataURL(token);

    return { qrCodeDataUrl, expiresAt: new Date(Date.now() + CHECKIN_TOKEN_TTL_MS).toISOString() };
  }
}
