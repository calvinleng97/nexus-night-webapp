import { describe, expect, it } from "vitest";
import { eventOrderKey, formatEventDate, isValidEventDate } from "@/lib/domain/schedule";
import { emptyEvent, setEventDate } from "@/lib/domain/event-machine";

const base = () =>
  emptyEvent({
    id: "ev_1",
    leagueId: "lg_1",
    name: "Night",
    createdBy: "mgr",
    totalRounds: 3,
    seed: 1,
    now: "2026-01-01T00:00:00.000Z",
  });

describe("validating a date", () => {
  it("accepts a wall-clock datetime", () => {
    // 2028 is a leap year; 2026 and 2027 are not.
    for (const v of ["2026-11-06T19:00", "2028-02-29T00:00", "2027-12-31T23:59"])
      expect(isValidEventDate(v), v).toBe(true);
  });

  it("rejects malformed input", () => {
    for (const v of ["", "2026-11-06", "06/11/2026 19:00", "2026-11-06T19:00:00", "nope"])
      expect(isValidEventDate(v), v).toBe(false);
  });

  it("rejects days that do not exist", () => {
    expect(isValidEventDate("2027-02-29T19:00")).toBe(false); // not a leap year
    expect(isValidEventDate("2026-02-29T19:00")).toBe(false); // nor is 2026
    expect(isValidEventDate("2026-04-31T19:00")).toBe(false);
    expect(isValidEventDate("2026-13-01T19:00")).toBe(false);
  });

  it("rejects impossible clock times", () => {
    expect(isValidEventDate("2026-11-06T24:00")).toBe(false);
    expect(isValidEventDate("2026-11-06T19:60")).toBe(false);
  });
});

describe("formatting", () => {
  it("prints the time that was typed, with no timezone drift", () => {
    // The danger with naive timestamps is a server in another zone shifting
    // them. 19:00 must read as 19:00 regardless of where this runs.
    expect(formatEventDate("2026-11-06T19:00")).toContain("19:00");
    expect(formatEventDate("2026-11-06T00:30")).toContain("00:30");
    expect(formatEventDate("2026-11-06T19:00")).toMatch(/Fri/);
  });

  it("returns null for nothing or nonsense", () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate("not a date")).toBeNull();
  });
});

describe("ordering", () => {
  it("uses the scheduled date when there is one", () => {
    const dated = { scheduledFor: "2026-11-06T19:00", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(eventOrderKey(dated)).toBe("2026-11-06T19:00");
  });

  it("falls back to creation time for undated events", () => {
    const undated = { scheduledFor: null, createdAt: "2026-03-04T05:06:07.000Z" };
    expect(eventOrderKey(undated)).toBe("2026-03-04T05:06");
  });

  it("sorts dated and undated events against each other sensibly", () => {
    const rows = [
      { scheduledFor: null, createdAt: "2026-01-01T00:00:00.000Z" },
      { scheduledFor: "2026-12-01T19:00", createdAt: "2026-02-01T00:00:00.000Z" },
      { scheduledFor: "2026-06-01T19:00", createdAt: "2026-03-01T00:00:00.000Z" },
    ];
    const sorted = [...rows].sort((a, b) => eventOrderKey(b).localeCompare(eventOrderKey(a)));
    expect(sorted.map((r) => r.scheduledFor)).toEqual([
      "2026-12-01T19:00",
      "2026-06-01T19:00",
      null,
    ]);
  });
});

describe("setting the date on an event", () => {
  it("defaults to undated", () => {
    expect(base().scheduledFor).toBeNull();
  });

  it("lets a manager schedule and reschedule", () => {
    const first = setEventDate(base(), "mgr", "2026-11-06T19:00");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.event.scheduledFor).toBe("2026-11-06T19:00");

    const moved = setEventDate(first.value.event, "mgr", "2026-11-13T18:30");
    if (!moved.ok) throw new Error(moved.error);
    expect(moved.value.event.scheduledFor).toBe("2026-11-13T18:30");
  });

  it("lets a manager clear the date", () => {
    const set = setEventDate(base(), "mgr", "2026-11-06T19:00");
    if (!set.ok) throw new Error(set.error);
    const cleared = setEventDate(set.value.event, "mgr", null);
    if (!cleared.ok) throw new Error(cleared.error);
    expect(cleared.value.event.scheduledFor).toBeNull();
  });

  it("refuses a non-manager", () => {
    expect(setEventDate(base(), "someone", "2026-11-06T19:00").ok).toBe(false);
  });

  it("refuses nonsense dates", () => {
    const res = setEventDate(base(), "mgr", "2026-02-31T19:00");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/real date/i);
  });

  it("refuses to move a finished event", () => {
    const done = { ...base(), status: "complete" as const };
    expect(setEventDate(done, "mgr", "2026-11-06T19:00").ok).toBe(false);
  });

  it("does not mutate the event it was given", () => {
    const original = base();
    setEventDate(original, "mgr", "2026-11-06T19:00");
    expect(original.scheduledFor).toBeNull();
  });
});
