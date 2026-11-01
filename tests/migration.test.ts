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

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexus-migrate-"));
  await mkdir(join(dataDir, "leagues"), { recursive: true });
  await writeFile(
    join(dataDir, "leagues", "lg_legacy.json"),
    JSON.stringify(V1_LEAGUE, null, 2),
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

describe("v1 -> v2 migration", () => {
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
