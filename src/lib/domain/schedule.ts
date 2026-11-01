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
