import { beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA_VERSION } from "@/lib/store/schema";

/**
 * Migrations run once at startup, so this needs its own file: the store
 * memoizes its bootstrap and the config caches its data directory.
 */
let repo: typeof import("@/lib/store/repo");
let dataDir: string;

const V1_LEAGUE = {
  id: "lg_legacy",
  name: "Written before join codes",
  // no joinCode — this is the shape schema v1 wrote
  createdBy: "u_old",
  managerIds: ["u_old"],
  memberIds: ["u_old", "u_other"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * A deck still saved by its owner, which the v5 migration can read the cards
 * back out of. Its name has since been changed, which the event must ignore.
 */
const SAVED_DECK = {
  id: "dk_live",
  ownerId: "u_old",
  name: "Renamed since",
  legend: "Riven, The Exile",
  champions: [{ count: 1, name: "Riven, Broken Blade" }],
  mainDeck: [
    { count: 3, name: "Gust" },
    { count: 2, name: "Defy" },
  ],
  battlefields: [],
  runes: [{ count: 6, name: "Calm Rune" }],
  sideboard: [],
  source: "Legend:\n1 Riven, The Exile\n\nMainDeck:\n3 Gust\n2 Defy\n",
  createdAt: "2026-01-02T00:00:00.000Z",
};

/**
 * An event holding registrations in the pre-v5 shape: a name and a Legend,
 * but no cards. One points at a deck that still exists, the other at one the
 * owner has already deleted.
 */
const PRE_V5_EVENT = {
  id: "ev_legacy",
  leagueId: "lg_legacy",
  name: "Before lists were kept",
  status: "complete",
  totalRounds: 3,
  scheduledFor: null,
  createdBy: "u_old",
  managerIds: ["u_old"],
  players: [
    {
      userId: "u_old",
      joinedAt: "2026-01-03T00:00:00.000Z",
      deck: {
        deckId: "dk_live",
        name: "Riven, as played",
        legend: "Riven, The Exile",
        registeredAt: "2026-01-03T00:00:00.000Z",
      },
      droppedAfterRound: null,
    },
    {
      userId: "u_other",
      joinedAt: "2026-01-03T00:00:00.000Z",
      deck: {
        deckId: "dk_deleted",
        name: "Vex list",
        legend: "Vex, Apathetic",
        registeredAt: "2026-01-03T00:00:00.000Z",
      },
      droppedAfterRound: null,
    },
  ],
  rounds: [],
  seed: 1,
  createdAt: "2026-01-03T00:00:00.000Z",
  startedAt: "2026-01-03T19:00:00.000Z",
  completedAt: "2026-01-03T22:00:00.000Z",
};

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexus-migrate-"));
  await mkdir(join(dataDir, "leagues"), { recursive: true });
  await mkdir(join(dataDir, "decks"), { recursive: true });
  await mkdir(join(dataDir, "events"), { recursive: true });
  await writeFile(
    join(dataDir, "leagues", "lg_legacy.json"),
    JSON.stringify(V1_LEAGUE, null, 2),
    "utf8",
  );
  await writeFile(
    join(dataDir, "decks", "dk_live.json"),
    JSON.stringify(SAVED_DECK, null, 2),
    "utf8",
  );
  await writeFile(
    join(dataDir, "events", "ev_legacy.json"),
    JSON.stringify(PRE_V5_EVENT, null, 2),
    "utf8",
  );
  await writeFile(
    join(dataDir, "meta.json"),
    JSON.stringify({ schemaVersion: 1, createdAt: V1_LEAGUE.createdAt, app: "nexus-night-webapp" }),
    "utf8",
  );
  process.env.NEXUS_DATA_DIR = dataDir;
  repo = await import("@/lib/store/repo");
});

describe("store migrations", () => {
  it("gives a league written without a join code a usable one", async () => {
    await repo.storeReady();

    const league = (await repo.getLeague("lg_legacy"))!;
    expect(league.joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    // Nothing else about the league is disturbed.
    expect(league.name).toBe(V1_LEAGUE.name);
    expect(league.memberIds).toEqual(V1_LEAGUE.memberIds);
    expect(league.createdAt).toBe(V1_LEAGUE.createdAt);

    // The generated code actually works, and is findable.
    const found = await repo.getLeagueByJoinCode(league.joinCode);
    expect(found?.id).toBe("lg_legacy");
  });

  it("stamps the new schema version so it does not run again", async () => {
    await repo.storeReady();
    const meta = JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8"));
    expect(meta.schemaVersion).toBe(SCHEMA_VERSION);

    // A second bootstrap must not re-issue the code.
    const before = (await repo.getLeague("lg_legacy"))!.joinCode;
    await repo.initStore();
    expect((await repo.getLeague("lg_legacy"))!.joinCode).toBe(before);
  });

  it("backfills a registered deck's cards from the deck that is still saved", async () => {
    await repo.storeReady();

    const event = (await repo.getEvent("ev_legacy"))!;
    const row = event.players.find((p) => p.userId === "u_old")!;
    expect(row.deck?.mainDeck).toEqual([
      { count: 3, name: "Gust" },
      { count: 2, name: "Defy" },
    ]);
    expect(row.deck?.runes).toEqual([{ count: 6, name: "Calm Rune" }]);
    expect(row.deck?.source).toContain("3 Gust");
    // The night's own record of the name wins over the deck's current one.
    expect(row.deck?.name).toBe("Riven, as played");
    expect(row.deck?.registeredAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("keeps the name of a deck whose cards are gone for good", async () => {
    await repo.storeReady();

    const event = (await repo.getEvent("ev_legacy"))!;
    const row = event.players.find((p) => p.userId === "u_other")!;
    expect(row.deck?.name).toBe("Vex list");
    expect(row.deck?.legend).toBe("Vex, Apathetic");
    // Unrecoverable: the deck was deleted before cards were ever snapshotted.
    expect(row.deck?.mainDeck).toEqual([]);
    expect(row.deck?.source).toBe("");
  });

  it("marks an event written before cancellation existed as not cancelled", async () => {
    await repo.storeReady();
    const event = (await repo.getEvent("ev_legacy"))!;
    expect(event.cancelledAt).toBeNull();
    expect(event.eloReverted).toBe(false);
    expect(event.status).toBe("complete");
  });

  it("leaves a migrated event alone on a second bootstrap", async () => {
    await repo.storeReady();
    const before = JSON.stringify((await repo.getEvent("ev_legacy"))!.players);
    await repo.initStore();
    expect(JSON.stringify((await repo.getEvent("ev_legacy"))!.players)).toBe(before);
  });

  it("refuses a data directory from a newer build", async () => {
    const future = await mkdtemp(join(tmpdir(), "nexus-future-"));
    await writeFile(
      join(future, "meta.json"),
      JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, createdAt: "now", app: "x" }),
      "utf8",
    );
    process.env.NEXUS_DATA_DIR = future;
    // The config is already cached, so point the check at the directory directly.
    const { resetConfigCache } = await import("@/lib/config");
    resetConfigCache();
    await expect(repo.initStore()).rejects.toThrow(/newer version/i);
    resetConfigCache();
    process.env.NEXUS_DATA_DIR = dataDir;
  });
});
