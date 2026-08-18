// Server runs in UTC; the only real deployment is Kazakhstan (Asia/Almaty,
// UTC+5, no DST). Rather than pull in a full IANA timezone library, the
// offset is hardcoded here — this is the one true home for it, imported by
// everything that needs local-vs-UTC conversion. If the network ever spans
// timezones, this is the single place to swap for a per-branch lookup.
export const LOCAL_UTC_OFFSET_MINUTES = 5 * 60;

/** Trailing "Z", "+05:00" or "+0500" — anything that pins the string to a real instant. */
const HAS_EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parses a date-time string that may or may not carry a timezone.
 *
 * The browser's `<input type="datetime-local">` submits a *naive* wall-clock
 * string ("2026-08-18T09:00") with no zone. Passing that straight to
 * `new Date()` makes the ES spec read it as the *server's* local time, which
 * in a UTC container silently stores 09:00 Almaty as 09:00 UTC — five hours
 * late. So a naive value is interpreted as Almaty wall-clock, which is what
 * the person typing it into the form actually meant.
 *
 * Values that do carry a zone are respected as-is (never double-shifted), and
 * date-only values keep the UTC-midnight convention every date-only column in
 * this codebase already uses.
 */
export function parseLocalDateTime(value: string): Date {
  const trimmed = value.trim();

  if (HAS_EXPLICIT_ZONE.test(trimmed)) return new Date(trimmed);
  if (!trimmed.includes("T")) return new Date(trimmed);

  return new Date(new Date(`${trimmed}Z`).getTime() - LOCAL_UTC_OFFSET_MINUTES * 60_000);
}
