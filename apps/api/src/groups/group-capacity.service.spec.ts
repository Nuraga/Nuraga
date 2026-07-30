import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { GroupCapacityService } from "./group-capacity.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "u1",
    email: "u1@example.com",
    phone: null,
    fullName: "Test",
    grants: [],
    hasNetworkAccess: false,
    ...overrides,
  };
}

describe("GroupCapacityService", () => {
  let prisma: { group: Record<string, jest.Mock>; child: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: GroupCapacityService;

  const branchId = "b1";
  const groupId = "g1";
  const manager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  function setGroup(plannedCapacity: number, maxCapacity: number) {
    prisma.group.findUnique.mockResolvedValue({ id: groupId, plannedCapacity, maxCapacity });
  }

  beforeEach(() => {
    prisma = {
      group: { findUnique: jest.fn() },
      child: { count: jest.fn(() => Promise.resolve(0)) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new GroupCapacityService(prisma as any, branchScope, audit as any);
  });

  it("throws NotFoundException for a missing group", async () => {
    prisma.group.findUnique.mockResolvedValue(null);
    await expect(service.getOccupancy(groupId)).rejects.toThrow(NotFoundException);
  });

  it("reports occupancy flags relative to planned/max capacity", async () => {
    setGroup(10, 12);
    prisma.child.count.mockResolvedValue(10);

    const occupancy = await service.getOccupancy(groupId);
    expect(occupancy).toMatchObject({
      enrolled: 10,
      isOverPlanned: true,
      isOverMax: false,
    });
  });

  it("allows enrollment within maxCapacity without any override", async () => {
    setGroup(10, 12);
    prisma.child.count.mockResolvedValue(9);

    const result = await service.assertCanEnroll(teacher, branchId, groupId, false);
    expect(result.enrolled).toBe(9);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("blocks enrollment beyond maxCapacity without confirmation", async () => {
    setGroup(10, 12);
    prisma.child.count.mockResolvedValue(12);

    await expect(service.assertCanEnroll(teacher, branchId, groupId, false)).rejects.toThrow(
      ConflictException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects the override from a role without branch-manager rights", async () => {
    setGroup(10, 12);
    prisma.child.count.mockResolvedValue(12);

    await expect(service.assertCanEnroll(teacher, branchId, groupId, true)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows a confirmed override from a Branch Manager and records an audit entry", async () => {
    setGroup(10, 12);
    prisma.child.count.mockResolvedValue(12);

    const result = await service.assertCanEnroll(manager, branchId, groupId, true);
    expect(result.enrolled).toBe(12);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "group", actorId: manager.id }),
    );
  });
});
