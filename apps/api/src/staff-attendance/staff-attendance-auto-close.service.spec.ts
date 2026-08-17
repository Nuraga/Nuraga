import { StaffAttendanceAutoCloseService } from "./staff-attendance-auto-close.service";

// The cron fires at 18:00 UTC == 23:00 Asia/Almaty. Anchoring every test to a
// fixed instant keeps the local-day maths verifiable by hand.
const RUN_AT = new Date("2026-08-17T18:00:00.000Z"); // 23:00 local, 17 Aug
const localTime = (hhmm: string, day = "2026-08-17") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 7, Number(day.slice(-2)), h - 5, m));
};

function checkInEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    staffId: "s1",
    type: "CHECK_IN",
    occurredAt: localTime("08:00"),
    staff: {
      id: "s1",
      userId: "u1",
      branchId: "b1",
      expectedCheckOutTime: null,
      user: { fullName: "Айгуль Н." },
    },
    ...overrides,
  };
}

describe("StaffAttendanceAutoCloseService", () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let notifications: { create: jest.Mock };
  let service: StaffAttendanceAutoCloseService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(RUN_AT);
    prisma = {
      staffAttendanceEvent: {
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn((args: any) => Promise.resolve({ id: "new1", ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    notifications = { create: jest.fn(() => Promise.resolve()) };
    service = new StaffAttendanceAutoCloseService(prisma, audit as any, notifications as any);
  });

  afterEach(() => jest.useRealTimers());

  it("scans exactly the local calendar day, not the UTC one", async () => {
    await service.closeForgottenCheckOuts();

    const { where } = prisma.staffAttendanceEvent.findMany.mock.calls[0][0];
    // Local 17 Aug 00:00 == 16 Aug 19:00 UTC.
    expect(where.occurredAt.gte.toISOString()).toBe("2026-08-16T19:00:00.000Z");
    expect(where.occurredAt.lt.toISOString()).toBe("2026-08-17T19:00:00.000Z");
  });

  it("closes an open shift at the default 18:00 local", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([checkInEvent()]);

    const closed = await service.closeForgottenCheckOuts();

    expect(closed).toBe(1);
    const created = prisma.staffAttendanceEvent.create.mock.calls[0][0].data;
    expect(created.type).toBe("CHECK_OUT");
    expect(created.source).toBe("AUTO_CLOSE");
    // 18:00 local == 13:00 UTC.
    expect(created.occurredAt.toISOString()).toBe("2026-08-17T13:00:00.000Z");
  });

  it("honours an individual expected check-out time", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([
      checkInEvent({ staff: { ...checkInEvent().staff, expectedCheckOutTime: "14:30" } }),
    ]);

    await service.closeForgottenCheckOuts();

    const created = prisma.staffAttendanceEvent.create.mock.calls[0][0].data;
    expect(created.occurredAt.toISOString()).toBe("2026-08-17T09:30:00.000Z"); // 14:30 local
  });

  it("leaves someone who already scanned out alone", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([
      checkInEvent(),
      { ...checkInEvent({ id: "e2" }), type: "CHECK_OUT", occurredAt: localTime("17:30") },
    ]);

    const closed = await service.closeForgottenCheckOuts();

    expect(closed).toBe(0);
    expect(prisma.staffAttendanceEvent.create).not.toHaveBeenCalled();
  });

  it("re-closes someone who left and came back without scanning out again", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([
      checkInEvent(),
      { ...checkInEvent({ id: "e2" }), type: "CHECK_OUT", occurredAt: localTime("12:00") },
      checkInEvent({ id: "e3", occurredAt: localTime("13:00") }),
    ]);

    expect(await service.closeForgottenCheckOuts()).toBe(1);
  });

  it("never records a check-out before the check-in (evening arrival)", async () => {
    // Arrived 20:00 local, expected out 18:00 — naive maths would go backwards.
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([
      checkInEvent({ occurredAt: localTime("20:00") }),
    ]);

    await service.closeForgottenCheckOuts();

    const created = prisma.staffAttendanceEvent.create.mock.calls[0][0].data;
    expect(created.occurredAt.getTime()).toBe(localTime("20:00").getTime());
    expect(created.occurredAt.getTime()).toBeGreaterThanOrEqual(localTime("20:00").getTime());
  });

  it("tells the staff member their shift was closed for them", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([checkInEvent()]);

    await service.closeForgottenCheckOuts();

    expect(notifications.create).toHaveBeenCalledWith(
      "u1",
      "STAFF_SHIFT_AUTO_CLOSED",
      expect.stringContaining("18:00"),
    );
  });

  it("records an audit row marking the check-out as system-generated", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([checkInEvent()]);

    await service.closeForgottenCheckOuts();

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "staff_attendance_event",
        actorId: null,
        newValue: expect.objectContaining({ event: "auto_closed_check_out", basedOnExpectedCheckOut: "18:00" }),
      }),
    );
  });

  it("closes several people in one run", async () => {
    prisma.staffAttendanceEvent.findMany.mockResolvedValue([
      checkInEvent(),
      checkInEvent({
        id: "e2",
        staffId: "s2",
        staff: { ...checkInEvent().staff, id: "s2", userId: "u2" },
      }),
    ]);

    expect(await service.closeForgottenCheckOuts()).toBe(2);
  });
});
