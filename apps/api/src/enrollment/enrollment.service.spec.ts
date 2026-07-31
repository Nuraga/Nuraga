import { BadRequestException } from "@nestjs/common";
import { EnrollmentService } from "./enrollment.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { ChildAccessService } from "../children/child-access.service";
import type { GroupCapacityService } from "../groups/group-capacity.service";

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

describe("EnrollmentService", () => {
  const branchId = "b1";
  const childId = "c1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let childAccess: { assertWriteAccess: jest.Mock };
  let capacity: { assertCanEnroll: jest.Mock };
  let audit: { record: jest.Mock };
  let service: EnrollmentService;
  let currentChild: any;

  beforeEach(() => {
    currentChild = {
      id: childId,
      familyId: "f1",
      status: "WAITLIST",
      groupId: null,
    };

    prisma = {
      child: {
        findUnique: jest.fn(() => Promise.resolve(currentChild)),
        update: jest.fn((args: any) => {
          Object.assign(currentChild, args.data);
          return Promise.resolve(currentChild);
        }),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      group: {
        findUnique: jest.fn((args: any) =>
          Promise.resolve({ id: args.where.id, branchId, name: "Group" }),
        ),
      },
      waitlistEntry: { deleteMany: jest.fn(() => Promise.resolve()) },
      childHistoryEntry: { create: jest.fn(() => Promise.resolve()) },
      dischargeReason: {
        findUnique: jest.fn(() => Promise.resolve({ id: "dr1", name: "Выпуск", isActive: true })),
      },
    };
    childAccess = { assertWriteAccess: jest.fn() };
    capacity = { assertCanEnroll: jest.fn(() => Promise.resolve({})) };
    audit = { record: jest.fn(() => Promise.resolve()) };

    service = new EnrollmentService(
      prisma,
      childAccess as unknown as ChildAccessService,
      capacity as unknown as GroupCapacityService,
      audit as any,
    );
  });

  describe("enroll", () => {
    it("rejects enrolling a child that isn't on the waitlist", async () => {
      currentChild.status = "ENROLLED";
      await expect(
        service.enroll(manager, branchId, childId, { groupId: "g1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("checks capacity, updates the child, clears the waitlist, and records history", async () => {
      const result = await service.enroll(manager, branchId, childId, { groupId: "g1" });

      expect(capacity.assertCanEnroll).toHaveBeenCalledWith(manager, branchId, "g1", false);
      expect(result).toMatchObject({ status: "ENROLLED", groupId: "g1" });
      expect(prisma.waitlistEntry.deleteMany).toHaveBeenCalledWith({ where: { childId } });
      expect(prisma.childHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "enroll", toGroupId: "g1" }) }),
      );
    });

    it("rejects a future effectiveAt (no scheduler in Stage 1)", async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        service.enroll(manager, branchId, childId, { groupId: "g1", effectiveAt: future }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("transfer", () => {
    beforeEach(() => {
      currentChild.status = "ENROLLED";
      currentChild.groupId = "g1";
    });

    it("rejects transferring to the same group", async () => {
      await expect(
        service.transfer(manager, branchId, childId, { toGroupId: "g1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("moves the child and records fromGroupId/toGroupId in history", async () => {
      await service.transfer(manager, branchId, childId, { toGroupId: "g2" });
      expect(currentChild.groupId).toBe("g2");
      expect(prisma.childHistoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "transfer", fromGroupId: "g1", toGroupId: "g2" }),
        }),
      );
    });
  });

  describe("suspend/resume", () => {
    beforeEach(() => {
      currentChild.status = "ENROLLED";
      currentChild.groupId = "g1";
    });

    it("suspends an enrolled child", async () => {
      const result = await service.suspend(manager, branchId, childId, {});
      expect(result.status).toBe("SUSPENDED");
    });

    it("rejects resuming a child that isn't suspended", async () => {
      await expect(service.resume(manager, branchId, childId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it("resumes a suspended child and re-checks capacity", async () => {
      currentChild.status = "SUSPENDED";
      await service.resume(manager, branchId, childId, {});
      expect(capacity.assertCanEnroll).toHaveBeenCalledWith(manager, branchId, "g1", false);
      expect(currentChild.status).toBe("ENROLLED");
    });
  });

  describe("discharge", () => {
    it("rejects an unknown discharge reason", async () => {
      prisma.dischargeReason.findUnique.mockResolvedValue(null);
      await expect(
        service.discharge(manager, branchId, childId, { dischargeReasonId: "missing" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an archived discharge reason", async () => {
      prisma.dischargeReason.findUnique.mockResolvedValue({
        id: "dr1",
        name: "Выпуск",
        isActive: false,
      });
      await expect(
        service.discharge(manager, branchId, childId, { dischargeReasonId: "dr1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("discharges the child, clears their group, and clears the waitlist", async () => {
      currentChild.status = "ENROLLED";
      currentChild.groupId = "g1";

      const result = await service.discharge(manager, branchId, childId, {
        dischargeReasonId: "dr1",
      });

      expect(result).toMatchObject({ status: "DISCHARGED", groupId: null });
      expect(prisma.waitlistEntry.deleteMany).toHaveBeenCalledWith({ where: { childId } });
    });
  });
});
