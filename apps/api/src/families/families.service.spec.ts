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
  let tx: any;
  let audit: { record: jest.Mock };
  let password: { hash: jest.Mock };
  let service: FamiliesService;

  beforeEach(() => {
    tx = {
      user: { create: jest.fn((args: any) => Promise.resolve({ id: "newu1", ...args.data })) },
      parent: {
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
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
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "p1", familyId: "f1", fullName: "Иван Иванов", userId: null, email: null, phone: null }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve()),
      },
      trustedPerson: {
        create: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        findUnique: jest.fn(() => Promise.resolve({ id: "t1", familyId: "f1" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn(() => Promise.resolve()),
      },
      user: {
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    password = { hash: jest.fn(() => Promise.resolve("hashed")) };
    service = new FamiliesService(prisma, new BranchScopeService(), audit as any, password as any);
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

  describe("provisionParentAccount", () => {
    const dto = { password: "correcthorse", email: "anna@example.com" };

    it("rejects a role without family write access", async () => {
      await expect(
        service.provisionParentAccount(accountant, branchId, "f1", "p1", dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the parent already has an account", async () => {
      prisma.parent.findUnique.mockResolvedValue({ id: "p1", familyId: "f1", userId: "existing-user" });
      await expect(
        service.provisionParentAccount(manager, branchId, "f1", "p1", dto),
      ).rejects.toThrow("already has an account");
    });

    it("rejects when neither the dto nor the parent record has an email or phone", async () => {
      await expect(
        service.provisionParentAccount(manager, branchId, "f1", "p1", { password: "correcthorse" }),
      ).rejects.toThrow(/email or phone is required/);
    });

    it("rejects when the email is already taken", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "other-user" });
      await expect(
        service.provisionParentAccount(manager, branchId, "f1", "p1", dto),
      ).rejects.toThrow("already exists");
    });

    it("creates a User in a transaction and links it to the Parent, without a branch role", async () => {
      const result = await service.provisionParentAccount(manager, branchId, "f1", "p1", dto);

      expect(password.hash).toHaveBeenCalledWith("correcthorse");
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fullName: "Иван Иванов", email: "anna@example.com" }),
        }),
      );
      expect(tx.parent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "p1" }, data: { userId: "newu1" } }),
      );
      expect(result).toMatchObject({ userId: "newu1" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "parent" }));
    });

    it("falls back to the parent's existing phone when no email/phone is given in the dto", async () => {
      prisma.parent.findUnique.mockResolvedValue({
        id: "p1",
        familyId: "f1",
        fullName: "Иван Иванов",
        userId: null,
        email: null,
        phone: "+77011112233",
      });
      await service.provisionParentAccount(manager, branchId, "f1", "p1", { password: "correcthorse" });

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ phone: "+77011112233" }) }),
      );
    });
  });
});
