/**
 * Seed finished events into a league so the history and rating pages have
 * something real to show.
 *
 *   npx tsx scripts/seed-history.ts
 *   npx tsx scripts/seed-history.ts --events=5 --players=10
 *   npx tsx scripts/seed-history.ts --email=you@example.com --league=lg_xxx
 *
 * Results are driven by a hidden per-player skill, so ratings spread the way
 * they would over a few real nights instead of landing in a coin-flip heap.
 * Everything runs through the normal submit/confirm path — nothing is written
 * that a player could not have produced.
 */
import {
  confirmResult,
  currentRound,
  startEvent,
  submitResult,
} from "../src/lib/domain/event-machine";
import { computeLeagueElo } from "../src/lib/domain/elo";
import { loadConfig } from "../src/lib/config";
import type { UserId } from "../src/lib/domain/types";
import * as repo from "../src/lib/store/repo";

const FRIENDS = [
  "Mira", "Dev", "Priya", "Tomas", "Yuki", "Sam",
  "Noor", "Elias", "Rae", "Jonas", "Ines", "Otto",
];

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

let seed = 8675309;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

async function main() {
  const cfg = loadConfig();
  const events = Number(arg("events", "3"));
  const wantPlayers = Math.min(Number(arg("players", "8")), FRIENDS.length + 1);
  const email = arg("email");
  // Hidden skill for the target: positive wins more, negative loses more.
  // Byes go to the lowest-ranked player, so a negative value is how you get
  // one into the seeded history.
  const targetSkill = Number(arg("skill", "0.35"));

  // --- who is this for -----------------------------------------------------
  const all = await repo.listAllEvents();
  const everyone = await repo.getUsers(all.flatMap((e) => e.players.map((p) => p.userId)));
  let target = email
    ? [...everyone.values()].find((u) => u.email === email)
    : undefined;
  if (!target) {
    // Default to a real signed-in account rather than a demo fixture.
    const leagues = await repo.listLeagues();
    const ids = new Set(leagues.flatMap((l) => l.memberIds));
    const users = await repo.getUsers([...ids]);
    target = [...users.values()].find((u) => !u.googleSub.startsWith("demo-"));
  }
  if (!target) throw new Error("No signed-in user found. Sign in once, then re-run.");
  console.log(`Seeding history for ${target.name} <${target.email}>`);

  // --- which league --------------------------------------------------------
  const leagues = await repo.listLeagues();
  const leagueId = arg("league");
  const league =
    (leagueId ? leagues.find((l) => l.id === leagueId) : undefined) ??
    leagues.find((l) => l.managerIds.includes(target.id)) ??
    (await repo.createLeague({ name: `${target.name}'s league`, createdBy: target.id }));
  if (!league.managerIds.includes(target.id))
    throw new Error(
      `${target.name} is not a manager of "${league.name}", so events cannot be created there. ` +
        `Pass --league=<id> for a league they manage.`,
    );
  console.log(`League: ${league.name} (${league.id})`);

  // --- opponents -----------------------------------------------------------
  const roster: UserId[] = [target.id];
  const skill = new Map<UserId, number>([[target.id, targetSkill]]);
  for (const name of FRIENDS.slice(0, wantPlayers - 1)) {
    const u = await repo.upsertUser({
      googleSub: `demo-seed-${name.toLowerCase()}`,
      email: `${name.toLowerCase()}@example.com`,
      name,
      image: null,
    });
    await repo.joinLeague(league.id, u.id, league.joinCode);
    roster.push(u.id);
    // Spread hidden skill so ratings separate instead of milling around base.
    skill.set(u.id, (rand() - 0.5) * 1.6);
  }
  const nameOf = async (id: UserId) => (await repo.getUser(id))?.name ?? id;

  // --- play the nights -----------------------------------------------------
  const already = (await repo.listEventsForLeague(league.id)).length;
  for (let n = 1; n <= events; n++) {
    let event = await repo.createEvent({
      leagueId: league.id,
      name: `Nexus Night #${already + n}`,
      createdBy: target.id,
    });
    for (const id of roster) event = await repo.joinEvent(event.id, id);

    await repo.mutateEvent(event.id, target.id, (e) => {
      const res = startEvent(e, target.id);
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "event_started" } };
    });

    for (let r = 1; r <= event.totalRounds; r++) {
      const live = (await repo.getEvent(event.id))!;
      const round = currentRound(live);
      if (!round || round.closedAt !== null) break;

      for (const p of round.pairings) {
        if (p.b === null || p.status === "confirmed") continue;
        const edge = (skill.get(p.a) ?? 0) - (skill.get(p.b) ?? 0);
        const pA = 1 / (1 + Math.exp(-edge * 1.5));
        const roll = rand();

        let score: { a: number; b: number };
        if (roll > 0.94) score = { a: 1, b: 1 }; // time ran out
        else if (roll < pA * 0.92) score = { a: 2, b: rand() < 0.45 ? 1 : 0 };
        else score = { a: rand() < 0.45 ? 1 : 0, b: 2 };

        await repo.mutateEvent(event.id, p.a, (e) => {
          const res = submitResult(e, p.id, p.a, score);
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_submitted", pairingId: p.id } };
        });
        const after = (await repo.getEvent(event.id))!;
        const still = after.rounds
          .flatMap((rd) => rd.pairings)
          .find((x) => x.id === p.id);
        if (still?.status === "awaiting_confirmation") {
          await repo.mutateEvent(event.id, p.b, (e) => {
            const res = confirmResult(e, p.id, p.b!);
            if (!res.ok) throw new Error(res.error);
            return { event: res.value.event, log: { action: "result_confirmed", pairingId: p.id } };
          });
        }
      }
    }
    const done = (await repo.getEvent(event.id))!;
    console.log(`  ${done.name}: ${done.status} after ${done.rounds.length} rounds`);
  }

  // --- show the result -----------------------------------------------------
  const leagueEvents = await repo.listEventsForLeague(league.id);
  const fresh = (await repo.getLeague(league.id))!;
  const ratings = computeLeagueElo(leagueEvents, fresh.memberIds, cfg.elo);
  console.log(`\nElo in ${fresh.name}`);
  for (const r of ratings) {
    const you = r.userId === target.id ? "  <- you" : "";
    const rec = r.draws > 0 ? `${r.wins}-${r.losses}-${r.draws}` : `${r.wins}-${r.losses}`;
    console.log(
      `  ${String(r.rank).padStart(2)}. ${(await nameOf(r.userId)).padEnd(14)} ` +
        `${String(r.rating).padStart(4)}  ${rec.padEnd(7)} ${r.games} rated${you}`,
    );
  }
  console.log(`\nOpen /history as ${target.name} to see the match list.`);
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
