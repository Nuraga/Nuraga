import { parseLocalDateTime, LOCAL_UTC_OFFSET_MINUTES } from "./local-time";

describe("parseLocalDateTime", () => {
  it("reads a naive wall-clock string as Almaty time, not as the server's UTC", () => {
    // The bug this exists to prevent: a manager typing 09:00 into the
    // attendance correction form used to land in the DB as 09:00 UTC, which
    // reads back as 14:00 in Almaty.
    expect(parseLocalDateTime("2026-08-18T09:00").toISOString()).toBe("2026-08-18T04:00:00.000Z");
  });

  it("handles a naive value with seconds", () => {
    expect(parseLocalDateTime("2026-08-18T09:00:30").toISOString()).toBe("2026-08-18T04:00:30.000Z");
  });

  it("rolls back across midnight when the local time is before the offset", () => {
    expect(parseLocalDateTime("2026-08-18T03:00").toISOString()).toBe("2026-08-17T22:00:00.000Z");
  });

  it("respects an explicit Z instead of shifting it again", () => {
    expect(parseLocalDateTime("2026-08-18T09:00:00Z").toISOString()).toBe("2026-08-18T09:00:00.000Z");
  });

  it("respects an explicit numeric offset", () => {
    // 09:00+05:00 is already 04:00 UTC — must not become 23:00 the day before.
    expect(parseLocalDateTime("2026-08-18T09:00:00+05:00").toISOString()).toBe("2026-08-18T04:00:00.000Z");
  });

  it("respects an offset written without a colon", () => {
    expect(parseLocalDateTime("2026-08-18T09:00:00+0500").toISOString()).toBe("2026-08-18T04:00:00.000Z");
  });

  it("keeps date-only values at UTC midnight, matching every date-only column", () => {
    expect(parseLocalDateTime("2026-08-18").toISOString()).toBe("2026-08-18T00:00:00.000Z");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseLocalDateTime("  2026-08-18T09:00  ").toISOString()).toBe("2026-08-18T04:00:00.000Z");
  });

  it("round-trips: what the form shows is what comes back out in Almaty", () => {
    const typed = "2026-08-18T17:45";
    const stored = parseLocalDateTime(typed);
    const backToLocal = new Date(stored.getTime() + LOCAL_UTC_OFFSET_MINUTES * 60_000);
    expect(backToLocal.toISOString().slice(0, 16)).toBe(typed);
  });
});
