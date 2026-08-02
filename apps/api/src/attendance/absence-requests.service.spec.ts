import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AbsenceRequestsService } from "./absence-requests.service";
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

describe("AbsenceRequestsService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });

  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock };
  let service: AbsenceRequestsService;

  const pendingRequest = {
    id: "ar1",
    childId: "c1",
    dateFrom: new Date("2026-09-01"),
    dateTo: new Date("2026-09-03"),
    status: "PENDING",
    child: { id: "c1", familyId: "f1" },
  };

  beforeEach(() => {
    tx = {
      attendance: { upsert: jest.fn(() => Promise.resolve({})) },
      absenceRequest: {
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    prisma = {
      absenceRequest: {
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve(pendingRequest)),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      child: {
        findUniqueOrThrow: jest.fn(() => Promise.resolve({ id: "c1", groupId: "g1" })),
      },
      timesheetPeriod: { findUnique: jest.fn(() => Promise.resolve(null)) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    service = new AbsenceRequestsService(prisma, new BranchScopeService(), audit as any);
  });

  describe("listForBranch", () => {
    it("rejects a role without attendance-read access", async () => {
      await expect(service.listForBranch(user(), branchId)).rejects.toThrow(ForbiddenException);
    });

    it("allows Accountant (read-only) to list", async () => {
      await expect(service.listForBranch(accountant, branchId)).resolves.toEqual([]);
    });
  });

  describe("approve", () => {
    it("rejects Accountant (read-only, not a marker)", async () => {
      await expect(service.approve(accountant, branchId, "ar1")).rejects.toThrow(ForbiddenException);
    });

    it("404s when the request's child belongs to a different branch", async () => {
      prisma.family.findUnique.mockResolvedValue({ id: "f1", branchId: "other-branch" });
      await expect(service.approve(manager, branchId, "ar1")).rejects.toThrow(NotFoundException);
    });

    it("rejects approving a non-PENDING request", async () => {
      prisma.absenceRequest.findUnique.mockResolvedValue({ ...pendingRequest, status: "APPROVED" });
      await expect(service.approve(manager, branchId, "ar1")).rejects.toThrow(BadRequestException);
    });

    it("rejects when the child has no group", async () => {
      prisma.child.findUniqueOrThrow.mockResolvedValue({ id: "c1", groupId: null });
      await expect(service.approve(manager, branchId, "ar1")).rejects.toThrow(BadRequestException);
    });

    it("blocks approval when any date in range falls in a closed timesheet period", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ status: "CLOSED" });
      await expect(service.approve(manager, branchId, "ar1")).rejects.toThrow(ConflictException);
    });

    it("upserts ABSENT_EXCUSED attendance for every day in range and marks the request APPROVED", async () => {
      const result = await service.approve(manager, branchId, "ar1");

      // 2026-09-01 .. 2026-09-03 inclusive = 3 days
      expect(tx.attendance.upsert).toHaveBeenCalledTimes(3);
      expect(tx.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ childId: "c1", groupId: "g1", status: "ABSENT_EXCUSED" }),
          update: expect.objectContaining({ status: "ABSENT_EXCUSED" }),
        }),
      );
      expect(tx.absenceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "ar1" }, data: expect.objectContaining({ status: "APPROVED" }) }),
      );
      expect(result).toMatchObject({ status: "APPROVED" });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ newValue: expect.objectContaining({ event: "approve", datesMarked: 3 }) }),
      );
    });
  });

  describe("reject", () => {
    it("rejects a non-PENDING request", async () => {
      prisma.absenceRequest.findUnique.mockResolvedValue({ ...pendingRequest, status: "REJECTED" });
      await expect(service.reject(manager, branchId, "ar1", {})).rejects.toThrow(BadRequestException);
    });

    it("marks the request REJECTED with a comment, without touching Attendance", async () => {
      const result = await service.reject(manager, branchId, "ar1", { comment: "Нет справки" });

      expect(prisma.absenceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ar1" },
          data: expect.objectContaining({ status: "REJECTED", reviewComment: "Нет справки" }),
        }),
      );
      expect(result).toMatchObject({ status: "REJECTED" });
      expect(tx.attendance.upsert).not.toHaveBeenCalled();
    });
  });
});
