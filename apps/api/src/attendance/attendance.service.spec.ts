import { ConflictException } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { AttendanceAccessService } from "./attendance-access.service";

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

describe("AttendanceService", () => {
  const branchId = "b1";
  const childId = "c1";
  const groupId = "g1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let access: { assertMarkAccess: jest.Mock; assertReadAccess: jest.Mock };
  let audit: { record: jest.Mock };
  let service: AttendanceService;
  let currentChild: any;

  beforeEach(() => {
    currentChild = {
      id: childId,
      familyId: "f1",
      groupId,
      status: "ENROLLED",
    };

    prisma = {
      child: {
        findUnique: jest.fn(() => Promise.resolve(currentChild)),
        findMany: jest.fn(() => Promise.resolve([currentChild])),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      group: {
        findUnique: jest.fn((args: any) =>
          Promise.resolve({ id: args.where.id, branchId, name: "Group" }),
        ),
      },
      attendance: {
        upsert: jest.fn((args: any) => Promise.resolve({ id: "a1", ...args.create, ...args.update })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      timesheetPeriod: {
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
    };
    access = { assertMarkAccess: jest.fn(), assertReadAccess: jest.fn() };
    audit = { record: jest.fn(() => Promise.resolve()) };

    service = new AttendanceService(prisma, access as unknown as AttendanceAccessService, audit as any);
  });

  describe("mark", () => {
    it("rejects marking a child that isn't enrolled", async () => {
      currentChild.status = "WAITLIST";
      currentChild.groupId = null;
      await expect(
        service.mark(manager, branchId, childId, { date: "2026-07-30", status: "PRESENT" }),
      ).rejects.toThrow(ConflictException);
    });

    it("checks mark access for the child's group", async () => {
      await service.mark(manager, branchId, childId, { date: "2026-07-30", status: "PRESENT" });
      expect(access.assertMarkAccess).toHaveBeenCalledWith(manager, branchId, groupId);
    });

    it("rejects marking when the timesheet period is closed", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ status: "CLOSED" });
      await expect(
        service.mark(manager, branchId, childId, { date: "2026-07-30", status: "PRESENT" }),
      ).rejects.toThrow(ConflictException);
    });

    it("upserts the attendance row and records an audit entry", async () => {
      const result = await service.mark(manager, branchId, childId, {
        date: "2026-07-30",
        status: "PRESENT",
      });

      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId_date: { childId, date: new Date("2026-07-30") } },
        }),
      );
      expect(result).toMatchObject({ status: "PRESENT" });
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe("getGroupRoster", () => {
    it("merges enrolled children with their attendance for the date, defaulting to null", async () => {
      const roster = await service.getGroupRoster(manager, branchId, groupId, "2026-07-30");

      expect(access.assertReadAccess).toHaveBeenCalledWith(manager, branchId, groupId);
      expect(roster).toEqual([{ child: currentChild, attendance: null }]);
    });
  });

  describe("getChildHistory", () => {
    it("checks read access for the child's group and queries by date range", async () => {
      await service.getChildHistory(manager, branchId, childId, "2026-07-01", "2026-07-31");

      expect(access.assertReadAccess).toHaveBeenCalledWith(manager, branchId, groupId);
      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            childId,
            date: { gte: new Date("2026-07-01"), lte: new Date("2026-07-31") },
          }),
        }),
      );
    });
  });
});
