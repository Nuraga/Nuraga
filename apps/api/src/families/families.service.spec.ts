import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { FamiliesService } from "./families.service";
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

describe("FamiliesService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let service: FamiliesService;

  beforeEach(() => {
    prisma = {
      family: {
        create: jest.fn((args: any) => Promise.resolve({ id: "f1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId, name: "Ивановы" })),
        findUniqueOrThrow: jest.fn(() => Promise.resolve({ id: "f1", branchId, name: "Ивановы" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      parent: {
        create: jest.fn((args: any) => Promise.resolve({ id: "p1", ...args.data })),
        findUnique: jest.fn(() => Promise.resolve({ id: "p1", familyId: "f1" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve()),
      },
      trustedPerson: {
        create: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        findUnique: jest.fn(() => Promise.resolve({ id: "t1", familyId: "f1" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve()),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    service = new FamiliesService(prisma, new BranchScopeService(), audit as any);
  });

  it("rejects family creation from Accountant (read-only role)", async () => {
    await expect(service.create(accountant, branchId, { name: "New" })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects family list/read for Teacher (works via Children, not Families)", async () => {
    await expect(service.findAllForBranch(teacher, branchId)).rejects.toThrow(ForbiddenException);
  });

  it("allows Accountant to read but not write", async () => {
    await expect(service.findOne(accountant, branchId, "f1")).resolves.toMatchObject({
      id: "f1",
    });
    await expect(
      service.update(accountant, branchId, "f1", { name: "Renamed" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("404s when the family belongs to a different branch (IDOR guard)", async () => {
    prisma.family.findUnique.mockResolvedValue({ id: "f1", branchId: "other-branch" });
    await expect(service.findOne(manager, branchId, "f1")).rejects.toThrow(NotFoundException);
  });

  it("adds a parent to a family and records an audit entry", async () => {
    const parent = await service.addParent(manager, branchId, "f1", {
      fullName: "Иван Иванов",
      relationship: "отец",
    });
    expect(parent).toMatchObject({ fullName: "Иван Иванов", familyId: "f1", contactPriority: 1 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "parent" }));
  });

  it("404s updateParent when the parent belongs to a different family", async () => {
    prisma.parent.findUnique.mockResolvedValue({ id: "p1", familyId: "other-family" });
    await expect(
      service.updateParent(manager, branchId, "f1", "p1", { fullName: "X" }),
    ).rejects.toThrow(NotFoundException);
  });
});
