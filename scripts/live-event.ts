/**
 * Park an event in the middle of round 1 so every player view can be looked at
 * at once: one match untouched, one reported and awaiting confirmation, one
 * already confirmed, and one bye.
 *
 *   npx tsx scripts/live-event.ts                 # first league you manage
 *   npx tsx scripts/live-event.ts --league=lg_x --players=7
 *
 * Prints which player is in which state, so you know who to sign in as.
 */
import { currentRound, startEvent, submitResult, confirmResult } from "../src/lib/domain/event-machine";
import * as repo from "../src/lib/store/repo";

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const wanted = Number(arg("players", "7"));
  const leagues = await repo.listLeagues();
  const leagueId = arg("league");

  const league =
    (leagueId ? leagues.find((l) => l.id === leagueId) : undefined) ??
    leagues.find((l) => l.memberIds.length >= wanted);
  if (!league) throw new Error(`No league with at least ${wanted} members. Run seed-history first.`);

  const users = await repo.getUsers(league.memberIds);
  const manager = league.managerIds[0]!;
  const roster = league.memberIds.slice(0, wanted);
  if (roster.length < 2) throw new Error("Need at least 2 players.");

  let event = await repo.createEvent({
    leagueId: league.id,
    name: "Nexus Night (live)",
    createdBy: manager,
  });
  for (const id of roster) event = await repo.joinEvent(event.id, id);
  await repo.mutateEvent(event.id, manager, (e) => {
    const res = startEvent(e, manager);
    if (!res.ok) throw new Error(res.error);
    return { event: res.value.event, log: { action: "event_started" } };
  });

  const round = currentRound((await repo.getEvent(event.id))!)!;
  const matches = round.pairings.filter((p) => p.b !== null);
  const bye = round.pairings.find((p) => p.b === null);

  // Match 2: one side reports, so their opponent sees a confirm prompt.
  const awaiting = matches[1];
  if (awaiting) {
    await repo.mutateEvent(event.id, awaiting.a, (e) => {
      const res = submitResult(e, awaiting.id, awaiting.a, { a: 2, b: 1 });
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "result_submitted", pairingId: awaiting.id } };
    });
  }
  // Match 3: fully agreed, so it shows as settled while the round stays open.
  const settled = matches[2];
  if (settled) {
    await repo.mutateEvent(event.id, settled.a, (e) => {
      const res = submitResult(e, settled.id, settled.a, { a: 2, b: 0 });
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "result_submitted", pairingId: settled.id } };
    });
    await repo.mutateEvent(event.id, settled.b!, (e) => {
      const res = confirmResult(e, settled.id, settled.b!);
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "result_confirmed", pairingId: settled.id } };
    });
  }

  const name = (id: string | null) => (id ? (users.get(id)?.name ?? id) : "—");
  console.log(`event      ${event.id}`);
  console.log(`league     ${league.name} (${league.id})`);
  console.log(`manager    ${name(manager)}`);
  if (matches[0]) console.log(`pending    ${name(matches[0].a)} vs ${name(matches[0].b)}  (neither has reported)`);
  if (awaiting) console.log(`reported   ${name(awaiting.a)} -> waiting on ${name(awaiting.b)} to confirm`);
  if (settled) console.log(`settled    ${name(settled.a)} 2-0 ${name(settled.b)}  (both agreed)`);
  if (bye) console.log(`bye        ${name(bye.a)}`);
  console.log(`\nOpen /events/${event.id} signed in as any of the above.`);
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
