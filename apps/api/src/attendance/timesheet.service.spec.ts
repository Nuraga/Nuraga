import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { TimesheetService } from "./timesheet.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { BranchScopeService } from "../common/access/branch-scope.service";

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

describe("TimesheetService", () => {
  const branchId = "b1";
  const owner = user({ grants: [{ branchId, role: "OWNER" }], hasNetworkAccess: true });

  let prisma: any;
  let branchScope: { assertBranchAccess: jest.Mock; assertRoleInBranch: jest.Mock };
  let audit: { record: jest.Mock };
  let service: TimesheetService;

  beforeEach(() => {
    prisma = {
      timesheetPeriod: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: jest.fn((args: any) => Promise.resolve({ id: "p1", branchId, ...args.create })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      attendance: {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "a1", groupId: "g1", date: new Date("2026-06-15") }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: "a1", ...args.data })),
      },
      group: {
        findUnique: jest.fn(() => Promise.resolve({ id: "g1", branchId })),
      },
      timesheetCorrection: {
        create: jest.fn(() => Promise.resolve({ id: "tc1" })),
      },
    };
    branchScope = { assertBranchAccess: jest.fn(), assertRoleInBranch: jest.fn() };
    audit = { record: jest.fn(() => Promise.resolve()) };

    service = new TimesheetService(prisma, branchScope as unknown as BranchScopeService, audit as any);
  });

  describe("closePeriod", () => {
    it("checks role access before closing", async () => {
      await service.closePeriod(owner, branchId, 2026, 7);
      expect(branchScope.assertRoleInBranch).toHaveBeenCalledWith(
        owner,
        ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT"],
        branchId,
      );
    });

    it("rejects closing an already-closed period", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ status: "CLOSED" });
      await expect(service.closePeriod(owner, branchId, 2026, 7)).rejects.toThrow(ConflictException);
    });

    it("upserts the period as CLOSED and records an audit entry", async () => {
      const result = await service.closePeriod(owner, branchId, 2026, 7);
      expect(result).toMatchObject({ status: "CLOSED", year: 2026, month: 7 });
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe("correctAttendance", () => {
    it("rejects when the attendance record isn't found", async () => {
      prisma.attendance.findUnique.mockResolvedValue(null);
      await expect(
        service.correctAttendance(owner, branchId, "missing", { reason: "typo" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects when the record's period is still open", async () => {
      await expect(
        service.correctAttendance(owner, branchId, "a1", { reason: "typo" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates attendance and writes a TimesheetCorrection when the period is closed", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ id: "p1", status: "CLOSED" });

      const result = await service.correctAttendance(owner, branchId, "a1", {
        status: "PRESENT",
        reason: "Забыли отметить вовремя",
      });

      expect(result).toMatchObject({ status: "PRESENT" });
      expect(prisma.timesheetCorrection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodId: "p1",
            attendanceId: "a1",
            reason: "Забыли отметить вовремя",
            actorUserId: owner.id,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalled();
    });
  });
});
