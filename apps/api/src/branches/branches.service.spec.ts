import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { BranchesService } from "./branches.service";
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

describe("BranchesService", () => {
  let prisma: { branch: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: BranchesService;

  beforeEach(() => {
    prisma = {
      branch: {
        create: jest.fn((args: any) => Promise.resolve({ id: "b1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([{ id: "b1" }])),
        findUnique: jest.fn(() => Promise.resolve({ id: "b1", name: "Old" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new BranchesService(prisma as any, branchScope, audit as any);
  });

  it("rejects branch creation from a non-network-admin role", async () => {
    const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });
    await expect(service.create(manager, { name: "New Branch" })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows Owner to create a branch and records an audit entry", async () => {
    const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
    const branch = await service.create(owner, { name: "New Branch" });

    expect(branch).toMatchObject({ name: "New Branch" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "branch", action: "create", actorId: "u1" }),
    );
  });

  it("scopes findAllForUser to accessible branch ids for a branch-scoped user", async () => {
    const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });
    await service.findAllForUser(manager);

    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["b1"] } } }),
    );
  });

  it("uses an unrestricted filter for network-wide users", async () => {
    const owner = user({ hasNetworkAccess: true });
    await service.findAllForUser(owner);

    expect(prisma.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("denies findOneForUser for a branch the user has no grant in", async () => {
    const manager = user({ grants: [{ branchId: "other-branch", role: "BRANCH_MANAGER" }] });
    await expect(service.findOneForUser(manager, "b1")).rejects.toThrow(ForbiddenException);
  });

  it("raises NotFoundException when the branch row is missing", async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    const owner = user({ hasNetworkAccess: true });
    await expect(service.findOneForUser(owner, "missing")).rejects.toThrow(NotFoundException);
  });
});
