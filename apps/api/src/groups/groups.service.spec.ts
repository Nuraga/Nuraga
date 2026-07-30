import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { GroupsService } from "./groups.service";
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

describe("GroupsService", () => {
  let prisma: {
    group: Record<string, jest.Mock>;
    groupType: Record<string, jest.Mock>;
  };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: GroupsService;

  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  beforeEach(() => {
    prisma = {
      group: {
        create: jest.fn((args: any) => Promise.resolve({ id: "g1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: "g1",
            branchId,
            plannedCapacity: 10,
            maxCapacity: 12,
          }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      groupType: {
        findUnique: jest.fn(() => Promise.resolve({ id: "gt1", name: "Младшая" })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new GroupsService(prisma as any, branchScope, audit as any);
  });

  it("rejects group creation from a role without branch management rights", async () => {
    await expect(
      service.create(teacher, branchId, {
        groupTypeId: "gt1",
        name: "Group A",
        plannedCapacity: 10,
        maxCapacity: 12,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects maxCapacity below plannedCapacity", async () => {
    await expect(
      service.create(manager, branchId, {
        groupTypeId: "gt1",
        name: "Group A",
        plannedCapacity: 10,
        maxCapacity: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects an unknown groupTypeId", async () => {
    prisma.groupType.findUnique.mockResolvedValue(null);
    await expect(
      service.create(manager, branchId, {
        groupTypeId: "missing",
        name: "Group A",
        plannedCapacity: 10,
        maxCapacity: 12,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("creates a group and records an audit entry", async () => {
    const group = await service.create(manager, branchId, {
      groupTypeId: "gt1",
      name: "Group A",
      plannedCapacity: 10,
      maxCapacity: 12,
    });

    expect(group).toMatchObject({ name: "Group A", branchId });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "group" }));
  });

  it("404s findOne when the group belongs to a different branch (IDOR guard)", async () => {
    prisma.group.findUnique.mockResolvedValue({ id: "g1", branchId: "other-branch" });
    await expect(service.findOne(manager, branchId, "g1")).rejects.toThrow(NotFoundException);
  });

  it("denies findOne for a user with no grant in the branch", async () => {
    const outsider = user({ grants: [{ branchId: "somewhere-else", role: "TEACHER" }] });
    await expect(service.findOne(outsider, branchId, "g1")).rejects.toThrow(ForbiddenException);
  });
});
