import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { GroupTypesService } from "./group-types.service";
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

describe("GroupTypesService", () => {
  let prisma: { groupType: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: GroupTypesService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });

  beforeEach(() => {
    prisma = {
      groupType: {
        create: jest.fn((args: any) => Promise.resolve({ id: "gt1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "gt1", name: "Младшая", minAgeMonths: 24, maxAgeMonths: 36 }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new GroupTypesService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from a non-network-admin role", async () => {
    await expect(
      service.create(manager, { name: "Ясли", minAgeMonths: 12, maxAgeMonths: 24 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects maxAgeMonths below minAgeMonths", async () => {
    await expect(
      service.create(owner, { name: "Ясли", minAgeMonths: 24, maxAgeMonths: 12 }),
    ).rejects.toThrow(BadRequestException);
  });

  it("allows Owner to create a group type and records an audit entry", async () => {
    const groupType = await service.create(owner, {
      name: "Ясли",
      minAgeMonths: 12,
      maxAgeMonths: 24,
    });

    expect(groupType).toMatchObject({ name: "Ясли" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "group_type", action: "create" }),
    );
  });

  it("raises NotFoundException when updating a missing group type", async () => {
    prisma.groupType.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "gt1");
    expect(result).toMatchObject({ isActive: false });
  });
});
