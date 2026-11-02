/**
 * Register decklists onto events that have already been played, so the
 * league Decks page and the per-event deck roster have real content.
 *
 *   npx tsx scripts/seed-decks.ts
 *   npx tsx scripts/seed-decks.ts --league=lg_xxx --force
 *
 * Each player gets one or two saved decks and brings them to the nights they
 * played, so the "every deck this person has played" view has something to
 * group. Players who already have a deck registered on an event are left
 * alone unless --force is passed.
 *
 * A finished event is immutable through the domain machine — on purpose:
 * nobody gets to say afterwards that they played a different deck. Seeding
 * is fabricating history anyway, so this script writes the registration
 * straight onto the stored event rather than pretending otherwise. It is the
 * one thing here no player action could produce.
 */
import { setPlayerDeck } from "../src/lib/domain/event-machine";
import { snapshotDeck } from "../src/lib/domain/deck";
import type { Deck, NexusEvent, UserId } from "../src/lib/domain/types";
import * as repo from "../src/lib/store/repo";

/** Invented lists in the plain-text format, one per archetype. */
const ARCHETYPES: Array<{ name: string; source: string }> = [
  {
    name: "Riven aggro",
    source: `Legend:
1 Riven, The Exile

Champion:
1 Riven, Broken Blade

MainDeck:
3 Gust
3 Blade Dance
3 Ki Burst
3 Astral Heron
2 Valor
2 Defy
2 Zhonya's Hourglass
2 Broken Wings
1 Baron Nashor

Battlefields:
1 Emperor's Dais
1 Noxkraya Arena

Runes:
7 Fury Rune
5 Calm Rune`,
  },
  {
    name: "Vex control",
    source: `Legend:
1 Vex, Apathetic

Champion:
1 Vex, Gloomy

MainDeck:
3 Doom
3 Shadow Stir
3 Pierce
3 Sap Magic
2 Hush
2 Vile Feast
2 Withering Wail
2 Blitzcrank, Impassive
1 Baron Nashor

Battlefields:
1 The Shadow Isles
1 Emperor's Dais

Runes:
6 Chaos Rune
6 Calm Rune`,
  },
  {
    name: "Jinx burn",
    source: `Legend:
1 Jinx, Loose Cannon

Champion:
1 Jinx, Get Excited

MainDeck:
3 Super Mega Death Rocket
3 Zap
3 Flame Chompers
3 Get Excited
3 Mystic Shot
2 Statikk Shiv
2 Decimate
1 Fireball

Battlefields:
1 Zaun Alleyway
1 Piltover Workshop

Runes:
8 Fury Rune
4 Chaos Rune`,
  },
  {
    name: "Lux ramp",
    source: `Legend:
1 Lux, Lady of Luminosity

Champion:
1 Lux, Illuminated

MainDeck:
3 Final Spark
3 Prismatic Barrier
3 Lucent Singularity
3 Radiant Guard
2 Starshaping
2 Single Combat
2 Bastion
2 Celestial Dawn
1 Baron Nashor

Battlefields:
1 Demacia Gates
1 Emperor's Dais

Runes:
7 Order Rune
5 Calm Rune`,
  },
  {
    name: "Viktor machines",
    source: `Legend:
1 Viktor, Machine Herald

Champion:
1 Viktor, Glorious Evolution

MainDeck:
3 Death Ray
3 Chaos Storm
3 Augment
3 Hextech Anomaly
2 Thermogenic Beam
2 Rummage
2 Blitzcrank, Impassive
2 Zhonya's Hourglass

Battlefields:
1 Piltover Workshop
1 Zaun Alleyway

Runes:
6 Chaos Rune
6 Order Rune`,
  },
  {
    name: "Yasuo tempo",
    source: `Legend:
1 Yasuo, Unforgiven

Champion:
1 Yasuo, Wandering Swordsman

MainDeck:
3 Last Breath
3 Wind Wall
3 Stand United
3 Gust
2 Deny
2 Twin Disciplines
2 Sonic Wave
2 Astral Heron
1 Baron Nashor

Battlefields:
1 Noxkraya Arena
1 Demacia Gates

Runes:
7 Calm Rune
5 Fury Rune`,
  },
];

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const force = process.argv.includes("--force");

async function main() {
  const leagueId = arg("league");
  const leagues = await repo.listLeagues();
  if (leagues.length === 0) throw new Error("No leagues in the data directory.");

  const league = leagueId
    ? leagues.find((l) => l.id === leagueId)
    : // Default to whichever league has the most played events.
      (
        await Promise.all(
          leagues.map(async (l) => ({
            league: l,
            played: (await repo.listEventsForLeague(l.id)).filter((e) => e.status !== "draft")
              .length,
          })),
        )
      ).sort((a, b) => b.played - a.played)[0]!.league;
  if (!league) throw new Error(`League ${leagueId} not found.`);

  const events = (await repo.listEventsForLeague(league.id)).filter((e) => e.status !== "draft");
  if (events.length === 0) throw new Error(`${league.name} has no played events to seed.`);

  const playerIds = [...new Set(events.flatMap((e) => e.players.map((p) => p.userId)))].sort();
  const users = await repo.getUsers(playerIds);
  const nameOf = (id: UserId) => users.get(id)?.name ?? id;

  // --- give everyone one or two decks -------------------------------------
  const owned = new Map<UserId, Deck[]>();
  for (const [i, userId] of playerIds.entries()) {
    const existing = await repo.listDecksForUser(userId);
    const wanted = [ARCHETYPES[i % ARCHETYPES.length]!];
    // Every third player is a two-deck player, so some people have a pool.
    if (i % 3 === 0) wanted.push(ARCHETYPES[(i + 2) % ARCHETYPES.length]!);

    const decks: Deck[] = [];
    for (const archetype of wanted) {
      const already = existing.find((d) => d.name === archetype.name);
      if (already) {
        decks.push(already);
        continue;
      }
      decks.push(
        await repo.createDeck({ ownerId: userId, name: archetype.name, source: archetype.source }),
      );
    }
    owned.set(userId, decks);
    console.log(`${nameOf(userId).padEnd(14)} ${decks.map((d) => d.name).join(", ")}`);
  }

  // --- bring them to the nights people played -----------------------------
  console.log("");
  for (const [eventIndex, event] of events.entries()) {
    let registered = 0;
    let skipped = 0;
    for (const player of event.players) {
      if (player.deck && !force) {
        skipped += 1;
        continue;
      }
      const decks = owned.get(player.userId);
      if (!decks || decks.length === 0) continue;
      // Mostly the main deck; the second one shows up at later events.
      const deck = decks[eventIndex % 3 === 2 ? decks.length - 1 : 0]!;
      await register(event.id, player.userId, deck);
      registered += 1;
    }
    console.log(
      `${event.name.padEnd(22)} ${String(registered).padStart(2)} registered` +
        (skipped > 0 ? `, ${skipped} already had one` : ""),
    );
  }

  console.log(`\nOpen /leagues/${league.id}/decks to see them.`);
}

/**
 * Write one registration. A draft or running event goes through the domain
 * machine; a finished one cannot, so the stored record is edited directly.
 */
async function register(eventId: string, userId: UserId, deck: Deck): Promise<void> {
  const snapshot = snapshotDeck(deck);
  await repo.mutateEvent(eventId, userId, (event: NexusEvent) => {
    if (event.status !== "complete") {
      const res = setPlayerDeck(event, userId, userId, snapshot);
      if (!res.ok) throw new Error(res.error);
      return { event: res.value.event, log: { action: "deck_registered", userId, seeded: true } };
    }
    return {
      event: {
        ...event,
        players: event.players.map((p) => (p.userId === userId ? { ...p, deck: snapshot } : p)),
      },
      log: { action: "deck_registered", userId, seeded: true, afterCompletion: true },
    };
  });
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
