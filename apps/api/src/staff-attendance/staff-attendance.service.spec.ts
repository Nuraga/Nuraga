import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { StaffAttendanceService, computeDailySummaries } from "./staff-attendance.service";
import { ExpectedScheduleService } from "./expected-schedule.service";
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
  const methodist = user({ id: "meth1", grants: [{ branchId, role: "METHODIST" }] });
  const device = { id: "d1", branchId };

  let prisma: any;
  let audit: { record: jest.Mock };
  let tokens: { verifyCheckinToken: jest.Mock };
  let notifications: { create: jest.Mock };
  let branchScope: BranchScopeService;
  let service: StaffAttendanceService;

  beforeEach(() => {
    prisma = {
      staff: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: "s1",
            userId: "u1",
            branchId,
            expectedCheckInTime: null,
            user: { fullName: "Иванова А." },
          }),
        ),
      },
      staffAttendanceEvent: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn((args: any) =>
          Promise.resolve({ id: "e1", occurredAt: args.data.occurredAt, ...args.data }),
        ),
      },
      staffVacation: { findFirst: jest.fn(() => Promise.resolve(null)) },
      timesheetPeriod: { findUnique: jest.fn(() => Promise.resolve(null)) },
      // No scheduled shifts: these tests assert the staff-card fallback.
      shift: { findMany: jest.fn(() => Promise.resolve([])) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    tokens = {
      verifyCheckinToken: jest.fn(() => Promise.resolve({ staffId: "s1", branchId })),
    };
    notifications = { create: jest.fn(() => Promise.resolve()) };
    // Real resolver over the mocked prisma: with no shift rows it falls back
    // to the staff card, which is what these tests assert against.
    const expectedSchedule = new ExpectedScheduleService(prisma);
    branchScope = new BranchScopeService();
    service = new StaffAttendanceService(
      prisma,
      branchScope,
      audit as any,
      tokens as any,
      notifications as any,
      expectedSchedule,
    );
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

    it("notifies the employee when they check in after the expected (default 08:00) time", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-13T04:00:00Z")); // 09:00 Almaty
      try {
        await service.recordScan(device, branchId, "tok");
      } finally {
        jest.useRealTimers();
      }
      expect(notifications.create).toHaveBeenCalledWith(
        "u1",
        "STAFF_LATE_CHECK_IN",
        expect.stringContaining("09:00"),
      );
    });

    it("does not notify when the check-in is on time", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-13T02:00:00Z")); // 07:00 Almaty
      try {
        await service.recordScan(device, branchId, "tok");
      } finally {
        jest.useRealTimers();
      }
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("does not notify a late check-in while the staff member is on an active vacation", async () => {
      prisma.staffVacation.findFirst.mockResolvedValue({ id: "v1" });
      jest.useFakeTimers().setSystemTime(new Date("2026-08-13T04:00:00Z")); // 09:00 Almaty
      try {
        await service.recordScan(device, branchId, "tok");
      } finally {
        jest.useRealTimers();
      }
      expect(notifications.create).not.toHaveBeenCalled();
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

    it("returns only staff whose latest event today is CHECK_IN, flagging a late arrival", async () => {
      prisma.staffAttendanceEvent.findMany.mockResolvedValue([
        {
          staffId: "s1",
          type: "CHECK_IN",
          // 07:00 Almaty (UTC+5) — on time against the 08:00 default.
          occurredAt: new Date("2026-08-13T02:00:00Z"),
          staff: { expectedCheckInTime: null, user: { id: "u1", fullName: "Иванова А." } },
        },
        {
          staffId: "s2",
          type: "CHECK_IN",
          // 09:00 Almaty — late against the 08:00 default.
          occurredAt: new Date("2026-08-13T04:00:00Z"),
          staff: { expectedCheckInTime: null, user: { id: "u2", fullName: "Петров Б." } },
        },
        {
          staffId: "s3",
          type: "CHECK_OUT",
          occurredAt: new Date(),
          staff: { expectedCheckInTime: null, user: { id: "u3", fullName: "Сидорова В." } },
        },
      ]);
      const present = await service.whoIsPresent(owner, branchId);
      expect(present).toEqual([
        { staffId: "s1", fullName: "Иванова А.", checkedInAt: expect.any(Date), isLate: false },
        { staffId: "s2", fullName: "Петров Б.", checkedInAt: expect.any(Date), isLate: true },
      ]);
    });

    it("respects an individual expectedCheckInTime override instead of the default", async () => {
      prisma.staffAttendanceEvent.findMany.mockResolvedValue([
        {
          staffId: "s1",
          type: "CHECK_IN",
          // 07:00 Almaty — on time against the 08:00 default, but late
          // against this staff member's own 06:30 start time.
          occurredAt: new Date("2026-08-13T02:00:00Z"),
          staff: { expectedCheckInTime: "06:30", user: { id: "u1", fullName: "Иванова А." } },
        },
      ]);
      const present = await service.whoIsPresent(owner, branchId);
      expect(present).toEqual([
        { staffId: "s1", fullName: "Иванова А.", checkedInAt: expect.any(Date), isLate: true },
      ]);
    });

    it("allows a METHODIST to view who is present (следит за посещениями)", async () => {
      await expect(service.whoIsPresent(methodist, branchId)).resolves.toEqual([]);
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
