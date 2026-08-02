import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import { ChildAccessService } from "./child-access.service";
import { ChildrenService } from "./children.service";
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

describe("ChildrenService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ id: "t1", grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let teacherScope: { getAssignedGroupIds: jest.Mock; isAssignedToGroup: jest.Mock };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let childAccess: ChildAccessService;
  let service: ChildrenService;

  beforeEach(() => {
    prisma = {
      family: {
        findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })),
      },
      child: {
        create: jest.fn((args: any) => Promise.resolve({ id: "c1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "c1", familyId: "f1", groupId: "g1", fullName: "Child" }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      childHistoryEntry: { findMany: jest.fn(() => Promise.resolve([])) },
    };
    teacherScope = {
      getAssignedGroupIds: jest.fn(() => Promise.resolve(["g1"])),
      isAssignedToGroup: jest.fn(() => Promise.resolve(true)),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    childAccess = new ChildAccessService(
      prisma,
      branchScope,
      teacherScope as unknown as TeacherScopeService,
    );
    service = new ChildrenService(
      prisma,
      branchScope,
      teacherScope as unknown as TeacherScopeService,
      childAccess,
      audit as any,
    );
  });

  it("rejects child creation from Teacher (write-restricted role)", async () => {
    await expect(
      service.create(teacher, branchId, "f1", { fullName: "New Child", birthDate: "2020-01-01" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("creates a child on the waitlist with no group assigned", async () => {
    const child = await service.create(manager, branchId, "f1", {
      fullName: "New Child",
      birthDate: "2020-01-01",
    });
    expect(child).toMatchObject({ status: "WAITLIST", familyId: "f1" });
    expect(child).not.toHaveProperty("groupId");
  });

  it("404s creation when the family belongs to a different branch", async () => {
    prisma.family.findUnique.mockResolvedValue({ id: "f1", branchId: "other-branch" });
    await expect(
      service.create(manager, branchId, "f1", { fullName: "X", birthDate: "2020-01-01" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("restricts a Teacher's listing to their assigned groups", async () => {
    await service.findAllForBranch(teacher, branchId, {});
    expect(prisma.child.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: { in: ["g1"] } }),
      }),
    );
  });

  it("rejects a Teacher filtering by a group they are not assigned to", async () => {
    await expect(
      service.findAllForBranch(teacher, branchId, { groupId: "other-group" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("gives full readers an unrestricted branch-wide listing", async () => {
    await service.findAllForBranch(manager, branchId, {});
    expect(prisma.child.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { family: { branchId } } }),
    );
  });

  it("update() rejects Teacher and only touches basic fields", async () => {
    await expect(
      service.update(teacher, branchId, "c1", { fullName: "Renamed" }),
    ).rejects.toThrow(ForbiddenException);

    const child = await service.update(manager, branchId, "c1", { fullName: "Renamed" });
    expect(child).toMatchObject({ fullName: "Renamed" });
  });
});
