/** Naive local wall-clock timestamps: "YYYY-MM-DDTHH:mm". */
const SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isValidEventDate(value: string): boolean {
  const m = SHAPE.exec(value);
  if (!m) return false;
  const [, y, mo, d, h, mi] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (Number(h) > 23 || Number(mi) > 59) return false;
  if (year < 2000 || year > 2100) return false;
  // Reject days that do not exist in that month, e.g. 31 February.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * Render for display. The stored value is wall-clock, so it is formatted in
 * UTC on purpose: that keeps the printed time identical to what was typed,
 * whatever timezone the server or reader happens to be in.
 */
export function formatEventDate(value: string | null): string | null {
  if (!value || !isValidEventDate(value)) return null;
  const m = SHAPE.exec(value)!;
  const [, y, mo, d, h, mi] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(dt);
}

/** Sort key: dated events by their date, undated ones by when they were made. */
export function eventOrderKey(event: { scheduledFor: string | null; createdAt: string }): string {
  return event.scheduledFor ?? event.createdAt.slice(0, 16);
}

/**
 * Short day label for either kind of timestamp the data holds: a wall-clock
 * event date ("2026-11-06T19:00") or an ISO instant (createdAt). Both are read
 * as their calendar date in UTC, which keeps a typed date printing as typed.
 */
export function formatDay(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/**
 * The pieces of an event date, for a calendar-style tile: "Tue", "3", "Nov",
 * "19:00". Read in UTC for the same reason as `formatEventDate`.
 */
export function eventDateParts(
  value: string | null,
): { weekday: string; day: string; month: string; time: string } | null {
  if (!value || !isValidEventDate(value)) return null;
  const [, y, mo, d, h, mi] = SHAPE.exec(value)!;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(dt);
  return {
    weekday: fmt({ weekday: "short" }),
    day: String(Number(d)),
    month: fmt({ month: "short" }),
    time: `${h}:${mi}`,
  };
}
