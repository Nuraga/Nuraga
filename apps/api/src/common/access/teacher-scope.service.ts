import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Narrows a TEACHER's branch-level grant down to "their groups only"
// (TRD 2.1: teacher scope is "Только свои группы"), via the Staff/StaffGroup
// assignment made in the Staff module.
@Injectable()
export class TeacherScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedGroupIds(userId: string, branchId: string): Promise<string[]> {
    const staff = await this.prisma.staff.findUnique({
      where: { userId },
      include: { groups: true },
    });
    if (!staff || staff.branchId !== branchId) return [];
    return staff.groups.map((g) => g.groupId);
  }

  async isAssignedToGroup(userId: string, branchId: string, groupId: string): Promise<boolean> {
    const groupIds = await this.getAssignedGroupIds(userId, branchId);
    return groupIds.includes(groupId);
  }
}
