import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startEvent, submitResult, confirmResult, currentRound } from "@/lib/domain/event-machine";

// The store reads its data directory from config on first use, so point it at a
// throwaway directory before anything imports it.
let repo: typeof import("@/lib/store/repo");
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexus-store-"));
  process.env.NEXUS_DATA_DIR = dataDir;
  repo = await import("@/lib/store/repo");
});

async function makeUser(sub: string, name: string) {
  return repo.upsertUser({ googleSub: sub, email: `${sub}@example.com`, name, image: null });
}

describe("file store round-trip", () => {
  it("creates the directory skeleton and stamps a schema version", async () => {
    await repo.storeReady();
    const entries = await readdir(dataDir);
    expect(entries).toContain("users");
    expect(entries).toContain("leagues");
    expect(entries).toContain("events");
    expect(entries).toContain("meta.json");
    const meta = JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8"));
    expect(meta.schemaVersion).toBe(1);
  });

  it("gives a user a stable id across repeated sign-ins", async () => {
    const first = await makeUser("sub-stable", "Calvin");
    const again = await repo.upsertUser({
      googleSub: "sub-stable",
      email: "changed@example.com",
      name: "Calvin L",
      image: null,
    });
    expect(again.id).toBe(first.id);
    expect(again.email).toBe("changed@example.com");
    expect(again.createdAt).toBe(first.createdAt);
  });

  it("persists a league and reads it back", async () => {
    const owner = await makeUser("sub-owner", "Owner");
    const league = await repo.createLeague({
      name: "Thursday Nexus",
      createdBy: owner.id,
    });
    const loaded = await repo.getLeague(league.id);
    expect(loaded?.name).toBe("Thursday Nexus");
    expect(loaded?.managerIds).toEqual([owner.id]);
    expect(await repo.listLeagues()).toHaveLength(1);
  });

  it("refuses event creation by a non-manager", async () => {
    const owner = await makeUser("sub-o2", "Owner2");
    const outsider = await makeUser("sub-out", "Outsider");
    const league = await repo.createLeague({ name: "L", createdBy: owner.id });
    await expect(
      repo.createEvent({ leagueId: league.id, name: "E", createdBy: outsider.id }),
    ).rejects.toThrow(/league manager/i);
  });

  it("runs a whole event through the store and logs every result", async () => {
    const owner = await makeUser("sub-mgr", "Manager");
    const league = await repo.createLeague({ name: "Run", createdBy: owner.id });
    const players = await Promise.all(
      [0, 1, 2, 3, 4].map((i) => makeUser(`sub-p${i}`, `Player ${i}`)),
    );
    let event = await repo.createEvent({
      leagueId: league.id,
      name: "Night 1",
      createdBy: owner.id,
      totalRounds: 3,
    });
    for (const p of players) event = await repo.joinEvent(event.id, p.id);
    expect(event.players).toHaveLength(5);

    const started = await repo.mutateEvent(event.id, owner.id, (e) => {
      const res = startEvent(e, owner.id);
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "event_started" } };
    });
    expect(started.event.status).toBe("running");

    // Play all three rounds through the store, A always winning 2-0.
    for (let r = 1; r <= 3; r++) {
      const live = (await repo.getEvent(event.id))!;
      const round = currentRound(live)!;
      for (const pairing of round.pairings) {
        if (pairing.status === "confirmed" || pairing.b === null) continue;
        await repo.mutateEvent(event.id, pairing.a, (e) => {
          const res = submitResult(e, pairing.id, pairing.a, { a: 2, b: 0 });
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_submitted", pairingId: pairing.id } };
        });
        await repo.mutateEvent(event.id, pairing.b, (e) => {
          const res = confirmResult(e, pairing.id, pairing.b!);
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_confirmed", pairingId: pairing.id } };
        });
      }
    }

    const final = (await repo.getEvent(event.id))!;
    expect(final.status).toBe("complete");
    expect(final.rounds).toHaveLength(3);

    // The append-only history must contain the full trail for stats later.
    const log = await readFile(join(dataDir, "events", event.id, "matches.jsonl"), "utf8");
    const records = log.trim().split("\n").map((l) => JSON.parse(l));
    const actions = records.map((r) => r.action);
    expect(actions).toContain("event_started");
    expect(actions).toContain("result_submitted");
    expect(actions).toContain("result_confirmed");
    expect(actions).toContain("round_paired");
    expect(actions).toContain("event_completed");
    expect(actions.filter((a) => a === "round_paired")).toHaveLength(3);
    // Every record is individually parseable and timestamped.
    for (const r of records) expect(typeof r.at).toBe("string");
  });

  it("serialises concurrent writes to the same event", async () => {
    const owner = await makeUser("sub-conc", "Conc");
    const league = await repo.createLeague({ name: "C", createdBy: owner.id });
    const event = await repo.createEvent({ leagueId: league.id, name: "C1", createdBy: owner.id });
    const players = await Promise.all([0, 1, 2, 3].map((i) => makeUser(`sub-c${i}`, `C${i}`)));

    // Four simultaneous joins must all land; a lost update would drop players.
    await Promise.all(players.map((p) => repo.joinEvent(event.id, p.id)));
    const loaded = (await repo.getEvent(event.id))!;
    expect(loaded.players).toHaveLength(4);
    expect(new Set(loaded.players.map((p) => p.userId)).size).toBe(4);
  });

  it("lets a manager remove a member, but not the creator or themselves", async () => {
    const owner = await makeUser("sub-kick-o", "KickOwner");
    const helper = await makeUser("sub-kick-h", "Helper");
    const victim = await makeUser("sub-kick-v", "Victim");
    const league = await repo.createLeague({ name: "Kickable", createdBy: owner.id });
    await repo.joinLeague(league.id, helper.id);
    await repo.joinLeague(league.id, victim.id);

    // A plain member cannot remove anyone.
    await expect(repo.removeLeagueMember(league.id, helper.id, victim.id)).rejects.toThrow(
      /league manager/i,
    );
    // The creator is protected even from themselves being removed by a manager.
    await repo.setLeagueManager(league.id, owner.id, helper.id, true);
    await expect(repo.removeLeagueMember(league.id, helper.id, owner.id)).rejects.toThrow(
      /creator cannot be removed/i,
    );
    // Removing yourself goes through "leave" instead.
    await expect(repo.removeLeagueMember(league.id, owner.id, owner.id)).rejects.toThrow(
      /Leave league/i,
    );

    const { league: after, warnings } = await repo.removeLeagueMember(
      league.id,
      owner.id,
      victim.id,
    );
    expect(after.memberIds).not.toContain(victim.id);
    expect(warnings).toHaveLength(0);

    // Removing a manager strips the manager role along with membership.
    const { league: afterHelper } = await repo.removeLeagueMember(league.id, owner.id, helper.id);
    expect(afterHelper.memberIds).not.toContain(helper.id);
    expect(afterHelper.managerIds).not.toContain(helper.id);

    // And a non-member cannot be removed twice.
    await expect(repo.removeLeagueMember(league.id, owner.id, victim.id)).rejects.toThrow(
      /not a league member/i,
    );
  });

  it("warns when the removed player is still active in a running event", async () => {
    const owner = await makeUser("sub-kick2-o", "Kick2Owner");
    const players = await Promise.all(
      [0, 1, 2, 3].map((i) => makeUser(`sub-kick2-p${i}`, `K2P${i}`)),
    );
    const league = await repo.createLeague({ name: "Live", createdBy: owner.id });
    for (const p of players) await repo.joinLeague(league.id, p.id);
    let event = await repo.createEvent({ leagueId: league.id, name: "Live night", createdBy: owner.id });
    for (const p of players) event = await repo.joinEvent(event.id, p.id);
    await repo.mutateEvent(event.id, owner.id, (e) => {
      const res = startEvent(e, owner.id);
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "event_started" } };
    });

    const { warnings } = await repo.removeLeagueMember(league.id, owner.id, players[0]!.id);
    expect(warnings.join(" ")).toMatch(/still playing in 1 event/i);
    // The event itself is untouched: their results and pairing remain.
    const live = (await repo.getEvent(event.id))!;
    expect(live.players.some((p) => p.userId === players[0]!.id)).toBe(true);
  });

  it("writes nothing outside the configured data directory", async () => {
    const entries = await readdir(dataDir);
    expect(new Set(entries)).toEqual(new Set(["users", "leagues", "events", "log", ".locks", "meta.json"]));
  });
});
