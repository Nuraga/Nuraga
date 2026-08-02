import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NETWORK_WIDE_ROLES, type AuthenticatedUser } from "./branch-access.types";

@Injectable()
export class UserContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branchRoles: true, parentProfile: true },
    });
    if (!user || !user.isActive) return null;

    const grants = user.branchRoles.map((g) => ({ branchId: g.branchId, role: g.role }));

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      grants,
      hasNetworkAccess: grants.some((g) => NETWORK_WIDE_ROLES.includes(g.role)),
      parentProfile: user.parentProfile
        ? { id: user.parentProfile.id, familyId: user.parentProfile.familyId }
        : null,
    };
  }
}
