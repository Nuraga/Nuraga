import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { StaffAttendanceService, computeDailySummaries } from "./staff-attendance.service";
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

describe("computeDailySummaries", () => {
  it("sums minutes between matched CHECK_IN/CHECK_OUT pairs on the same day", () => {
    const summaries = computeDailySummaries([
      { type: "CHECK_IN", occurredAt: new Date("2026-08-03T08:00:00Z") },
      { type: "CHECK_OUT", occurredAt: new Date("2026-08-03T17:00:00Z") },
    ]);
    expect(summaries).toEqual([{ date: "2026-08-03", workedMinutes: 540 }]);
  });

  it("sums multiple pairs in the same day (e.g. a lunch break)", () => {
    const summaries = computeDailySummaries([
      { type: "CHECK_IN", occurredAt: new Date("2026-08-03T08:00:00Z") },
      { type: "CHECK_OUT", occurredAt: new Date("2026-08-03T12:00:00Z") },
      { type: "CHECK_IN", occurredAt: new Date("2026-08-03T13:00:00Z") },
      { type: "CHECK_OUT", occurredAt: new Date("2026-08-03T17:00:00Z") },
    ]);
    expect(summaries).toEqual([{ date: "2026-08-03", workedMinutes: 480 }]);
  });

  it("ignores a dangling CHECK_IN with no matching CHECK_OUT yet", () => {
    const summaries = computeDailySummaries([{ type: "CHECK_IN", occurredAt: new Date("2026-08-03T08:00:00Z") }]);
    expect(summaries).toEqual([{ date: "2026-08-03", workedMinutes: 0 }]);
  });
});

describe("StaffAttendanceService", () => {
  const branchId = "b1";
  const owner = user({ id: "owner1", grants: [{ branchId, role: "OWNER" }] });
  const teacher = user({ id: "u1", grants: [{ branchId, role: "TEACHER" }] });
  const otherTeacher = user({ id: "u2", grants: [{ branchId, role: "TEACHER" }] });
  const device = { id: "d1", branchId };

  let prisma: any;
  let audit: { record: jest.Mock };
  let tokens: { verifyCheckinToken: jest.Mock };
  let branchScope: BranchScopeService;
  let service: StaffAttendanceService;

  beforeEach(() => {
    prisma = {
      staff: {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "s1", userId: "u1", branchId, user: { fullName: "Иванова А." } }),
        ),
      },
      staffAttendanceEvent: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn((args: any) =>
          Promise.resolve({ id: "e1", occurredAt: args.data.occurredAt, ...args.data }),
        ),
      },
      timesheetPeriod: { findUnique: jest.fn(() => Promise.resolve(null)) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    tokens = {
      verifyCheckinToken: jest.fn(() => Promise.resolve({ staffId: "s1", branchId })),
    };
    branchScope = new BranchScopeService();
    service = new StaffAttendanceService(prisma, branchScope, audit as any, tokens as any);
  });

  describe("recordScan", () => {
    it("rejects a device scanning for a different branch than the route", async () => {
      await expect(service.recordScan(device, "other-branch", "tok")).rejects.toThrow(ForbiddenException);
    });

    it("rejects an expired/invalid check-in token", async () => {
      tokens.verifyCheckinToken.mockRejectedValue(new Error("expired"));
      await expect(service.recordScan(device, branchId, "tok")).rejects.toThrow();
    });

    it("rejects a check-in token issued for a different branch", async () => {
      tokens.verifyCheckinToken.mockResolvedValue({ staffId: "s1", branchId: "other-branch" });
      await expect(service.recordScan(device, branchId, "tok")).rejects.toThrow(ForbiddenException);
    });

    it("records CHECK_IN as the first scan of the day", async () => {
      const result = await service.recordScan(device, branchId, "tok");
      expect(result).toMatchObject({ staffFullName: "Иванова А.", type: "CHECK_IN" });
      expect(prisma.staffAttendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "CHECK_IN", source: "QR" }) }),
      );
    });

    it("toggles to CHECK_OUT when the last event was CHECK_IN", async () => {
      prisma.staffAttendanceEvent.findFirst.mockResolvedValue({
        type: "CHECK_IN",
        occurredAt: new Date(Date.now() - 60 * 60_000),
      });
      const result = await service.recordScan(device, branchId, "tok");
      expect(result.type).toBe("CHECK_OUT");
    });

    it("debounces a repeat scan within 2 minutes and does not create a new event", async () => {
      prisma.staffAttendanceEvent.findFirst.mockResolvedValue({
        type: "CHECK_IN",
        occurredAt: new Date(Date.now() - 30_000),
      });
      const result = await service.recordScan(device, branchId, "tok");
      expect(result.type).toBe("CHECK_IN");
      expect(prisma.staffAttendanceEvent.create).not.toHaveBeenCalled();
    });

    it("rejects a scan for a staff member outside this branch", async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: "s1", branchId: "other-branch", user: { fullName: "X" } });
      await expect(service.recordScan(device, branchId, "tok")).rejects.toThrow(NotFoundException);
    });

    it("blocks scans once the timesheet period is closed", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ status: "CLOSED" });
      await expect(service.recordScan(device, branchId, "tok")).rejects.toThrow(ConflictException);
    });
  });

  describe("listForStaff", () => {
    it("allows a staff member to list their own events without a management role", async () => {
      await expect(service.listForStaff(teacher, branchId, "s1", {})).resolves.toMatchObject({ events: [] });
    });

    it("rejects a staff member listing someone else's events", async () => {
      await expect(service.listForStaff(otherTeacher, branchId, "s1", {})).rejects.toThrow(ForbiddenException);
    });

    it("allows a management role to list any staff member's events", async () => {
      await expect(service.listForStaff(owner, branchId, "s1", {})).resolves.toMatchObject({ events: [] });
    });
  });

  describe("whoIsPresent", () => {
    it("rejects a non-management role", async () => {
      await expect(service.whoIsPresent(teacher, branchId)).rejects.toThrow(ForbiddenException);
    });

    it("returns only staff whose latest event today is CHECK_IN", async () => {
      prisma.staffAttendanceEvent.findMany.mockResolvedValue([
        {
          staffId: "s1",
          type: "CHECK_IN",
          occurredAt: new Date(),
          staff: { user: { id: "u1", fullName: "Иванова А." } },
        },
        {
          staffId: "s2",
          type: "CHECK_OUT",
          occurredAt: new Date(),
          staff: { user: { id: "u2", fullName: "Петров Б." } },
        },
      ]);
      const present = await service.whoIsPresent(owner, branchId);
      expect(present).toEqual([{ staffId: "s1", fullName: "Иванова А.", checkedInAt: expect.any(Date) }]);
    });
  });

  describe("correctEvent", () => {
    it("rejects a non-management role", async () => {
      await expect(
        service.correctEvent(teacher, branchId, {
          staffId: "s1",
          type: "CHECK_IN",
          occurredAt: "2026-08-03T08:00:00Z",
          reason: "забыл отметиться",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates a MANUAL_CORRECTION event even when the period is open", async () => {
      const event = await service.correctEvent(owner, branchId, {
        staffId: "s1",
        type: "CHECK_IN",
        occurredAt: "2026-08-03T08:00:00Z",
        reason: "забыл отметиться",
      });
      expect(event).toMatchObject({ source: "MANUAL_CORRECTION", correctionReason: "забыл отметиться" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "staff_attendance_event" }));
    });
  });
});
