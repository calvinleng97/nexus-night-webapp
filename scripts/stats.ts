/**
 * Example of reading the data directory for statistics.
 *
 *   npx tsx scripts/stats.ts                 # uses nexus.config.json
 *   NEXUS_DATA_DIR=/srv/nexus-night/data npx tsx scripts/stats.ts
 *
 * Everything here is plain file reads — nothing is specific to the webapp, so
 * you can do the same from Python, jq, or anything else.
 */
import { loadConfig } from "../src/lib/config";
import { computeStandings } from "../src/lib/domain/standings";
import { getUsers, listAllEvents } from "../src/lib/store/repo";

interface Tally {
  events: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  gamesWon: number;
  gamesLost: number;
  opponents: Set<string>;
}

const blank = (): Tally => ({
  events: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  byes: 0,
  gamesWon: 0,
  gamesLost: 0,
  opponents: new Set(),
});

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(`Reading ${cfg.dataDir}\n`);

  const events = await listAllEvents();
  if (events.length === 0) {
    console.log("No events on disk yet. Try: npx tsx scripts/demo.ts");
    return;
  }

  const users = await getUsers(events.flatMap((e) => e.players.map((p) => p.userId)));
  const name = (id: string) => users.get(id)?.name ?? id;
  const career = new Map<string, Tally>();

  for (const event of events) {
    const standings = computeStandings(event);
    console.log(
      `== ${event.name} (${event.status}) — ${event.players.length} players, ` +
        `${event.rounds.length} rounds`,
    );
    for (const s of standings) {
      const t = career.get(s.userId) ?? blank();
      t.events += 1;
      t.wins += s.wins;
      t.losses += s.losses;
      t.draws += s.draws;
      t.byes += s.byes;
      t.gamesWon += s.gamesWon;
      t.gamesLost += s.gamesLost;
      for (const o of s.opponents) t.opponents.add(o);
      career.set(s.userId, t);
      console.log(
        `   ${String(s.rank).padStart(2)}. ${name(s.userId).padEnd(20)} ` +
          `${s.matchPoints} pts  ${s.wins}-${s.losses}${s.draws ? `-${s.draws}` : ""}` +
          `${s.byes ? "  (bye)" : ""}`,
      );
    }
    console.log();
  }

  console.log("== Career totals");
  const rows = [...career.entries()].sort((a, b) => b[1].wins - a[1].wins);
  for (const [id, t] of rows) {
    const played = t.wins + t.losses + t.draws;
    const rate = played > 0 ? `${((t.wins / played) * 100).toFixed(0)}%` : "—";
    console.log(
      `   ${name(id).padEnd(20)} ${t.events} event${t.events === 1 ? "" : "s"}  ` +
        `${t.wins}-${t.losses}-${t.draws}  ${rate} matches  ` +
        `games ${t.gamesWon}-${t.gamesLost}  ${t.opponents.size} distinct opponents`,
    );
  }
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
