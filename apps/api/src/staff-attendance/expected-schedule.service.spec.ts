import { ExpectedScheduleService, resolveExpected } from "./expected-schedule.service";

const card = (checkIn: string | null, checkOut: string | null) => ({
  expectedCheckInTime: checkIn,
  expectedCheckOutTime: checkOut,
});

describe("resolveExpected (shift -> staff card -> network default)", () => {
  it("uses the scheduled shift when there is one, ignoring the card", () => {
    expect(resolveExpected({ start: "12:00", end: "20:00" }, card("08:00", "18:00"))).toEqual({
      checkIn: "12:00",
      checkOut: "20:00",
      fromShift: true,
    });
  });

  it("falls back to the staff card on a day with no shift", () => {
    expect(resolveExpected(undefined, card("09:30", "16:00"))).toEqual({
      checkIn: "09:30",
      checkOut: "16:00",
      fromShift: false,
    });
  });

  it("falls back to the network defaults when the card is empty too", () => {
    expect(resolveExpected(undefined, card(null, null))).toEqual({
      checkIn: "08:00",
      checkOut: "18:00",
      fromShift: false,
    });
  });

  it("keeps lateness working when the schedule was never filled in", () => {
    // The whole reason the card is retained rather than replaced by shifts.
    const { checkIn } = resolveExpected(undefined, card(null, null));
    expect(checkIn).toBe("08:00");
  });
});

describe("ExpectedScheduleService.shiftWindows", () => {
  let prisma: any;
  let service: ExpectedScheduleService;
  const day = new Date("2026-08-17T00:00:00.000Z");

  beforeEach(() => {
    prisma = { shift: { findMany: jest.fn(() => Promise.resolve([])) } };
    service = new ExpectedScheduleService(prisma);
  });

  it("returns nothing (and asks the DB nothing) for an empty staff list", async () => {
    expect((await service.shiftWindows([], day, day)).size).toBe(0);
    expect(prisma.shift.findMany).not.toHaveBeenCalled();
  });

  it("maps one shift per staff-day", async () => {
    prisma.shift.findMany.mockResolvedValue([
      { staffId: "s1", date: day, startTime: "09:00", endTime: "17:00" },
    ]);

    const windows = await service.shiftWindows(["s1"], day, day);

    expect(windows.get(ExpectedScheduleService.key("s1", day))).toEqual({ start: "09:00", end: "17:00" });
  });

  it("collapses a split shift to the earliest start and latest end", async () => {
    // Morning + evening the same day: arriving for the first isn't late, and
    // the auto-close must not cut the day off at the morning slot's end.
    prisma.shift.findMany.mockResolvedValue([
      { staffId: "s1", date: day, startTime: "14:00", endTime: "19:00" },
      { staffId: "s1", date: day, startTime: "07:00", endTime: "11:00" },
    ]);

    const windows = await service.shiftWindows(["s1"], day, day);

    expect(windows.get(ExpectedScheduleService.key("s1", day))).toEqual({ start: "07:00", end: "19:00" });
  });

  it("keeps different people's shifts apart", async () => {
    prisma.shift.findMany.mockResolvedValue([
      { staffId: "s1", date: day, startTime: "08:00", endTime: "16:00" },
      { staffId: "s2", date: day, startTime: "12:00", endTime: "20:00" },
    ]);

    const windows = await service.shiftWindows(["s1", "s2"], day, day);

    expect(windows.get(ExpectedScheduleService.key("s1", day))!.start).toBe("08:00");
    expect(windows.get(ExpectedScheduleService.key("s2", day))!.start).toBe("12:00");
  });

  it("keeps the same person's different days apart", async () => {
    const nextDay = new Date("2026-08-18T00:00:00.000Z");
    prisma.shift.findMany.mockResolvedValue([
      { staffId: "s1", date: day, startTime: "08:00", endTime: "16:00" },
      { staffId: "s1", date: nextDay, startTime: "13:00", endTime: "21:00" },
    ]);

    const windows = await service.shiftWindows(["s1"], day, nextDay);

    expect(windows.get(ExpectedScheduleService.key("s1", day))!.start).toBe("08:00");
    expect(windows.get(ExpectedScheduleService.key("s1", nextDay))!.start).toBe("13:00");
  });

  it("de-duplicates repeated staff ids in one query", async () => {
    await service.shiftWindows(["s1", "s1", "s2"], day, day);

    const { where } = prisma.shift.findMany.mock.calls[0][0];
    expect(where.staffId.in).toEqual(["s1", "s2"]);
  });
});
