/**
 * Plays a complete Nexus Night through the real app layer and prints each step.
 *
 *   npx tsx scripts/demo.ts            # 7 players, 3 rounds
 *   npx tsx scripts/demo.ts 12         # 12 players
 *
 * Everything goes through the same storage and pairing code the webapp uses, so
 * the league and event this creates are real: sign in afterwards and they will
 * be there. Nothing here bypasses the rules — results are submitted, confirmed
 * and disputed exactly as players would.
 */
import {
  confirmResult,
  currentRound,
  disputeResult,
  startEvent,
  submitResult,
} from "../src/lib/domain/event-machine";
import { computeStandings, recordLabel } from "../src/lib/domain/standings";
import { loadConfig } from "../src/lib/config";
import type { NexusEvent, UserId } from "../src/lib/domain/types";
import * as repo from "../src/lib/store/repo";

const PLAYER_NAMES = [
  "Calvin", "Mira", "Dev", "Priya", "Tomas", "Yuki", "Sam",
  "Noor", "Elias", "Rae", "Jonas", "Ines", "Otto", "Liv", "Pax", "Zoe",
];

const n = Math.min(Math.max(Number(process.argv[2] ?? 7) || 7, 2), PLAYER_NAMES.length);
const cfg = loadConfig();

let seed = 20261101;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

const rule = (t: string) => console.log(`\n${t}\n${"─".repeat(t.length)}`);

async function main() {
  console.log(`Nexus Night demo — ${n} players, data dir: ${cfg.dataDir}`);

  // ---------------------------------------------------------------- sign-ins
  rule("1. Players sign in with Google");
  const stamp = Date.now();
  const users = [];
  for (const [i, name] of PLAYER_NAMES.slice(0, n).entries()) {
    // upsertUser is exactly what the Auth.js callback calls on sign-in.
    const u = await repo.upsertUser({
      googleSub: `demo-${stamp}-${i}`,
      email: `${name.toLowerCase()}@example.com`,
      name,
      image: null,
    });
    users.push(u);
  }
  const organiser = users[0]!;
  console.log(`   ${users.map((u) => u.name).join(", ")}`);
  console.log(`   ${organiser.name} is the organiser (id ${organiser.id})`);

  // ----------------------------------------------------------------- league
  rule("2. Organiser creates a league");
  const league = await repo.createLeague({
    name: `Thursday Nexus (demo ${new Date().toISOString().slice(0, 10)})`,
    description: "Weekly, at my place",
    createdBy: organiser.id,
  });
  console.log(`   "${league.name}"  ${league.id}`);
  console.log(`   ${organiser.name} is automatically a manager.`);

  rule("3. Everyone else joins (leagues are open)");
  for (const u of users.slice(1)) await repo.joinLeague(league.id, u.id);
  const joined = await repo.getLeague(league.id);
  console.log(`   ${joined!.memberIds.length} members, ${joined!.managerIds.length} manager`);

  // ------------------------------------------------------------------ event
  rule("4. Manager creates an event");
  let event = await repo.createEvent({
    leagueId: league.id,
    name: "Nexus Night #1",
    createdBy: organiser.id,
  });
  console.log(`   "${event.name}"  ${event.id}  —  ${event.totalRounds} rounds, status "${event.status}"`);

  rule("5. Players join the event");
  for (const u of users) event = await repo.joinEvent(event.id, u.id);
  console.log(`   ${event.players.length} signed up`);

  const nameOf = new Map<UserId, string>(users.map((u) => [u.id, u.name]));
  const who = (id: UserId | null) => (id ? (nameOf.get(id) ?? id) : "—");

  // ------------------------------------------------------------------ start
  rule("6. Manager starts the event");
  const started = await repo.mutateEvent(event.id, organiser.id, (e) => {
    const res = startEvent(e, organiser.id);
    if (!res.ok) throw new Error(res.error);
    return { event: res.value.event, log: { action: "event_started" }, warnings: res.value.warnings };
  });
  for (const w of started.warnings) console.log(`   ⚠ ${w}`);
  console.log(`   status "${started.event.status}" — round 1 paired`);

  // ------------------------------------------------------------- play rounds
  let disputeShown = false;
  for (let r = 1; r <= event.totalRounds; r++) {
    const live = (await repo.getEvent(event.id))!;
    const round = currentRound(live)!;
    rule(`Round ${round.number} pairings`);
    for (const p of round.pairings) {
      const tag = p.b === null ? "BYE" : p.rematch ? "(rematch)" : "";
      console.log(
        `   ${who(p.a).padEnd(8)} ${p.b === null ? "     " : "vs"} ${who(p.b).padEnd(8)} ${tag}`,
      );
    }

    for (const p of round.pairings) {
      if (p.b === null) continue;
      const a = p.a;
      const b = p.b;
      const aWins = rand() < 0.5;
      const close = rand() < 0.5;
      const score = aWins ? { a: 2, b: close ? 1 : 0 } : { a: close ? 1 : 0, b: 2 };

      // One match per demo shows the dispute path end to end.
      if (!disputeShown && r === 2) {
        disputeShown = true;
        console.log(`\n   Dispute walkthrough on ${who(a)} vs ${who(b)}:`);
        await repo.mutateEvent(event.id, a, (e) => {
          const res = submitResult(e, p.id, a, { a: 2, b: 0 });
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_submitted", pairingId: p.id } };
        });
        console.log(`     ${who(a)} submits "I won 2-0" → awaiting_confirmation`);
        const dis = await repo.mutateEvent(event.id, b, (e) => {
          const res = disputeResult(e, p.id, b);
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_disputed", pairingId: p.id }, warnings: res.value.warnings };
        });
        console.log(`     ${who(b)} taps "That's wrong" → disputed, round is blocked`);
        for (const w of dis.warnings) console.log(`     ⚠ ${w}`);
        await repo.mutateEvent(event.id, organiser.id, (e) => {
          const res = submitResult(e, p.id, organiser.id, { a: 1, b: 2 });
          if (!res.ok) throw new Error(res.error);
          return { event: res.value.event, log: { action: "result_overridden", pairingId: p.id } };
        });
        console.log(`     ${organiser.name} (manager) sets it to ${who(b)} 2-1 → confirmed, logged as an override`);
        continue;
      }

      await repo.mutateEvent(event.id, a, (e) => {
        const res = submitResult(e, p.id, a, score);
        if (!res.ok) throw new Error(res.error);
        return { event: res.value.event, log: { action: "result_submitted", pairingId: p.id } };
      });
      await repo.mutateEvent(event.id, b, (e) => {
        const res = confirmResult(e, p.id, b);
        if (!res.ok) throw new Error(res.error);
        return { event: res.value.event, log: { action: "result_confirmed", pairingId: p.id } };
      });
      console.log(
        `   ${who(a)} ${score.a}-${score.b} ${who(b)}   (submitted by ${who(a)}, confirmed by ${who(b)})`,
      );
    }

    const after = (await repo.getEvent(event.id))!;
    // A bye is credited the moment its round is paired, so the auto-advance
    // has already handed the next round's bye-holder 3 points. Truncate to the
    // round just played so this table really is "standings after round r".
    printStandings({ ...after, rounds: after.rounds.filter((rd) => rd.number <= round.number) }, who);
    if (after.status === "complete") {
      console.log(`\n   Event auto-completed after round ${round.number}.`);
      break;
    }
    console.log(`   → round ${round.number} closed, round ${round.number + 1} paired automatically`);
  }

  // ------------------------------------------------------------------ wrap
  const final = (await repo.getEvent(event.id))!;
  rule("Final");
  console.log(`   status: ${final.status}`);
  printStandings(final, who);

  rule("On disk");
  console.log(`   ${cfg.dataDir}/leagues/${league.id}.json`);
  console.log(`   ${cfg.dataDir}/events/${final.id}.json`);
  console.log(`   ${cfg.dataDir}/events/${final.id}/matches.jsonl   (append-only history)`);
  console.log(`\n   Sign in to the app and this league will be waiting for you.`);
}

function printStandings(event: NexusEvent, who: (id: UserId) => string) {
  console.log("");
  const rows = computeStandings(event);
  for (const s of rows) {
    const bye = s.byes > 0 ? ` bye×${s.byes}` : "";
    console.log(
      `   ${String(s.rank).padStart(2)}. ${who(s.userId).padEnd(8)} ` +
        `${String(s.matchPoints).padStart(2)} pts  ${recordLabel(s).padEnd(6)} ` +
        `games ${s.gamesWon}-${s.gamesLost}${bye}`,
    );
  }
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
