import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { StaffService } from "./staff.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { PasswordService } from "../auth/password.service";

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

describe("StaffService", () => {
  const branchId = "b1";
  const owner = user({ grants: [{ branchId, role: "OWNER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock };
  let password: { hash: jest.Mock };
  let branchScope: BranchScopeService;
  let service: StaffService;

  beforeEach(() => {
    tx = {
      user: { create: jest.fn((args: any) => Promise.resolve({ id: "newu1", ...args.data })) },
      userBranchRole: { create: jest.fn(() => Promise.resolve({})) },
      staff: {
        create: jest.fn((args: any) => Promise.resolve({ id: "s1", ...args.data })),
      },
    };
    prisma = {
      user: {
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
      staff: {
        create: jest.fn((args: any) => Promise.resolve({ id: "s1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "s1", branchId, userId: "u-staff", terminatedAt: null })),
        update: jest.fn((args: any) => Promise.resolve({ id: "s1", ...args.data })),
      },
      staffGroup: {
        upsert: jest.fn(() => Promise.resolve({})),
        deleteMany: jest.fn(() => Promise.resolve({})),
      },
      userBranchRole: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      $transaction: jest.fn((arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(tx),
      ),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    password = { hash: jest.fn(() => Promise.resolve("hashed")) };
    branchScope = new BranchScopeService();
    service = new StaffService(prisma, branchScope, audit as any, password as unknown as PasswordService);
  });

  describe("create", () => {
    it("rejects a role without staff management rights", async () => {
      await expect(
        service.create(teacher, branchId, { position: "Воспитатель" } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    describe("linking an existing user", () => {
      it("404s when the referenced user doesn't exist", async () => {
        await expect(
          service.create(owner, branchId, { userId: "missing", position: "Воспитатель" } as any),
        ).rejects.toThrow(NotFoundException);
      });

      it("creates a Staff row for an existing user", async () => {
        prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });
        const staff = await service.create(owner, branchId, {
          userId: "existing-user",
          position: "Воспитатель",
        } as any);

        expect(staff).toMatchObject({ userId: "existing-user", branchId, position: "Воспитатель" });
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "staff" }));
      });
    });

    describe("provisioning a new user", () => {
      const newUserDto = {
        fullName: "Иванова Мария",
        email: "maria@example.com",
        password: "correcthorse",
        role: "TEACHER",
        position: "Воспитатель",
      };

      it("rejects when fullName/password/role are incomplete", async () => {
        await expect(
          service.create(owner, branchId, { position: "Воспитатель" } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it("rejects when neither email nor phone is given", async () => {
        const withoutEmail = { ...newUserDto, email: undefined };
        await expect(service.create(owner, branchId, withoutEmail as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it("rejects a duplicate email", async () => {
        prisma.user.findUnique.mockResolvedValue({ id: "someone-else" });
        await expect(service.create(owner, branchId, newUserDto as any)).rejects.toThrow(
          ConflictException,
        );
      });

      it("creates the user, branch role grant, and staff record together", async () => {
        const staff = await service.create(owner, branchId, newUserDto as any);

        expect(password.hash).toHaveBeenCalledWith("correcthorse");
        expect(tx.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ fullName: "Иванова Мария", email: "maria@example.com" }),
          }),
        );
        expect(tx.userBranchRole.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: { userId: "newu1", branchId, role: "TEACHER" } }),
        );
        expect(tx.staff.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ userId: "newu1", position: "Воспитатель" }) }),
        );
        expect(staff).toMatchObject({ userId: "newu1", position: "Воспитатель" });
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "staff" }));
      });
    });
  });

  describe("assignGroup / unassignGroup", () => {
    it("404s when the staff member belongs to a different branch", async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: "s1", branchId: "other-branch" });
      await expect(service.assignGroup(owner, branchId, "s1", "g1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assigns a group and records an audit entry", async () => {
      await service.assignGroup(owner, branchId, "s1", "g1");
      expect(prisma.staffGroup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { staffId: "s1", groupId: "g1" } }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "staff_group" }));
    });
  });

  describe("terminate", () => {
    it("rejects a role without staff management rights", async () => {
      await expect(service.terminate(teacher, branchId, "s1", {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("404s when the staff member belongs to a different branch", async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: "s1", branchId: "other-branch" });
      await expect(service.terminate(owner, branchId, "s1", {})).rejects.toThrow(NotFoundException);
    });

    it("rejects a staff member who is already terminated", async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        branchId,
        userId: "u-staff",
        terminatedAt: new Date(),
      });
      await expect(service.terminate(owner, branchId, "s1", {})).rejects.toThrow(ConflictException);
    });

    it("sets terminatedAt, revokes this branch's role grants, and records an audit entry", async () => {
      await service.terminate(owner, branchId, "s1", { reason: "По собственному желанию" });

      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s1" },
          data: expect.objectContaining({ terminatedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.userBranchRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u-staff", branchId },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: "staff",
          newValue: { event: "terminated", reason: "По собственному желанию" },
        }),
      );
    });
  });
});
