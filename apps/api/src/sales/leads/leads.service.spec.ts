import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { LeadsService } from "./leads.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import type { GroupCapacityService } from "../../groups/group-capacity.service";

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

describe("LeadsService", () => {
  const branchId = "b1";
  const owner = user({ grants: [{ branchId, role: "OWNER" }] });
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });

  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock };
  let capacity: { assertCanEnroll: jest.Mock };
  let branchScope: BranchScopeService;
  let service: LeadsService;

  const baseLead = {
    id: "lead1",
    branchId,
    parentFullName: "Иванова Анна",
    parentPhone: "+7 701 111 22 33",
    parentPhoneNormalized: "77011112233",
    stage: "NEW",
    stageEnteredAt: new Date(),
    convertedFamilyId: null,
  };

  beforeEach(() => {
    tx = {
      family: { create: jest.fn((args: any) => Promise.resolve({ id: "fam1", ...args.data })) },
      parent: { create: jest.fn((args: any) => Promise.resolve({ id: "par1", ...args.data })) },
      child: { create: jest.fn((args: any) => Promise.resolve({ id: "child1", ...args.data })) },
      contract: { create: jest.fn((args: any) => Promise.resolve({ id: "con1", ...args.data })) },
      lead: { update: jest.fn((args: any) => Promise.resolve({ ...baseLead, ...args.data })) },
    };
    prisma = {
      lead: {
        findMany: jest.fn(() => Promise.resolve([])),
        findFirst: jest.fn(() => Promise.resolve(null)),
        findUnique: jest.fn(() => Promise.resolve(baseLead)),
        findUniqueOrThrow: jest.fn(() => Promise.resolve(baseLead)),
        create: jest.fn((args: any) => Promise.resolve({ id: "lead1", ...args.data })),
        update: jest.fn((args: any) => Promise.resolve({ ...baseLead, ...args.data })),
        delete: jest.fn(() => Promise.resolve(baseLead)),
      },
      leadActivity: {
        create: jest.fn((args: any) => Promise.resolve({ id: "act1", ...args.data })),
      },
      tariff: {
        findUnique: jest.fn(() => Promise.resolve({ id: "tar1", branchId, isActive: true })),
      },
      group: {
        findUnique: jest.fn(() => Promise.resolve({ id: "g1", branchId })),
      },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    capacity = { assertCanEnroll: jest.fn(() => Promise.resolve({})) };
    branchScope = new BranchScopeService();
    service = new LeadsService(prisma, branchScope, audit as any, capacity as unknown as GroupCapacityService);
  });

  describe("create", () => {
    const dto = { parentFullName: "Иванова Анна", parentPhone: "+7 701 111 22 33", responsibleUserId: "u2" };

    it("rejects a role without lead write access", async () => {
      await expect(service.create(accountant, branchId, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it("409s when a lead with the same normalized phone already exists and confirmDuplicate isn't set", async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: "existing" });
      await expect(service.create(manager, branchId, dto as any)).rejects.toThrow(ConflictException);
    });

    it("creates anyway when confirmDuplicate is true", async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: "existing" });
      const lead = await service.create(manager, branchId, { ...dto, confirmDuplicate: true } as any);
      expect(lead).toMatchObject({ parentFullName: "Иванова Анна" });
    });

    it("normalizes the phone for the dedup index", async () => {
      await service.create(manager, branchId, dto as any);
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ parentPhoneNormalized: "77011112233" }) }),
      );
    });
  });

  describe("checkDuplicates", () => {
    it("returns an empty list when nothing matches", async () => {
      const result = await service.checkDuplicates(manager, branchId, "+7 701 111 22 33");
      expect(result.duplicates).toEqual([]);
    });

    it("looks up by normalized phone network-wide, not branch-scoped", async () => {
      prisma.lead.findMany.mockResolvedValue([
        { id: "l2", branchId: "other-branch", branch: { name: "Другой филиал" }, stage: "NEW", responsibleUserId: "u3", childFullName: null, createdAt: new Date() },
      ]);
      const result = await service.checkDuplicates(manager, branchId, "8 (701) 111-22-33");
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentPhoneNormalized: "77011112233" } }),
      );
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]).toMatchObject({ branchId: "other-branch", branchName: "Другой филиал" });
    });
  });

  describe("updateStage", () => {
    it("rejects REJECTED without a rejectionReasonId", async () => {
      await expect(
        service.updateStage(manager, branchId, "lead1", { stage: "REJECTED" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks any stage change once the lead is in a terminal stage", async () => {
      prisma.lead.findUnique.mockResolvedValue({ ...baseLead, stage: "WAITLISTED" });
      await expect(
        service.updateStage(manager, branchId, "lead1", { stage: "CONTACTED" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates stage and stageEnteredAt on a valid transition", async () => {
      const lead = await service.updateStage(manager, branchId, "lead1", { stage: "CONTACTED" } as any);
      expect(lead.stage).toBe("CONTACTED");
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stage: "CONTACTED" }) }),
      );
    });
  });

  describe("convert", () => {
    const dto = {
      parentFullName: "Иванова Анна",
      parentRelationship: "мать",
      childFullName: "Иванов Иван",
      childBirthDate: "2022-01-01",
      tariffId: "tar1",
      contractNumber: "D-1",
      contractStartDate: "2026-09-01",
    };

    it("rejects a lead that was already converted", async () => {
      prisma.lead.findUnique.mockResolvedValue({ ...baseLead, convertedFamilyId: "fam-existing" });
      await expect(service.convert(manager, branchId, "lead1", dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a lead already in a terminal stage", async () => {
      prisma.lead.findUnique.mockResolvedValue({ ...baseLead, stage: "REJECTED" });
      await expect(service.convert(manager, branchId, "lead1", dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates Family+Parent+Child+Contract and flips the lead to ENROLLED", async () => {
      const result = await service.convert(manager, branchId, "lead1", dto as any);

      expect(tx.family.create).toHaveBeenCalled();
      expect(tx.parent.create).toHaveBeenCalled();
      expect(tx.child.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "WAITLIST" }) }),
      );
      expect(tx.contract.create).toHaveBeenCalled();
      expect(tx.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stage: "ENROLLED" }) }),
      );
      expect(result).toMatchObject({ familyId: "fam1", childId: "child1", contractId: "con1" });
    });

    it("checks group capacity and enrolls directly when a groupId is given", async () => {
      await service.convert(manager, branchId, "lead1", { ...dto, groupId: "g1" } as any);
      expect(capacity.assertCanEnroll).toHaveBeenCalledWith(manager, branchId, "g1", false);
      expect(tx.child.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "ENROLLED", groupId: "g1" }) }),
      );
    });
  });

  describe("remove", () => {
    it("rejects a Manager (no delete right per ТЗ §2.2)", async () => {
      await expect(service.remove(manager, branchId, "lead1")).rejects.toThrow(ForbiddenException);
    });

    it("allows Owner to delete", async () => {
      await service.remove(owner, branchId, "lead1");
      expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: "lead1" } });
    });
  });

  describe("get", () => {
    it("404s when the lead belongs to a different branch", async () => {
      prisma.lead.findUnique.mockResolvedValue({ ...baseLead, branchId: "other-branch" });
      await expect(service.get(manager, branchId, "lead1")).rejects.toThrow(NotFoundException);
    });
  });
});
