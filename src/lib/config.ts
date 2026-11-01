import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

export interface NexusConfig {
  /**
   * Absolute path to the directory that holds all data. Point this at an
   * existing directory and the app will use it as the database. Everything
   * the app writes lives under here and nowhere else.
   */
  dataDir: string;
  site: {
    name: string;
    /** Public base URL. Must match the Google OAuth redirect URI's origin. */
    url: string;
    /**
     * Shown on the privacy and terms pages so people have somewhere to write
     * about their data. Left blank, those pages tell readers to contact
     * whoever invited them instead.
     */
    contactEmail: string;
  };
  event: {
    /** Swiss rounds per event. Nexus Night standard is 3. */
    defaultRounds: number;
  };
  pairing: {
    /**
     * Which constraint wins when they conflict.
     * - "record": pair strictly within records, accepting a rematch when
     *   keeping equal records together requires one. (Nexus Night standard.)
     * - "avoid-rematch": never repeat a pairing unless the field makes it
     *   impossible, accepting mismatched records instead.
     * Either way a player never takes a second bye while anyone is eligible.
     */
    priority: "record" | "avoid-rematch";
  };
  /**
   * Per-league Elo. Ratings are recomputed from stored results on every view,
   * so changing these re-rates every past match.
   */
  elo: {
    base: number;
    k: number;
    provisionalK: number;
    provisionalGames: number;
  };
}

const DEFAULTS: NexusConfig = {
  dataDir: "./data",
  site: { name: "Nexus Night", url: "http://localhost:3000", contactEmail: "" },
  event: { defaultRounds: 3 },
  pairing: { priority: "record" },
  elo: { base: 1200, k: 24, provisionalK: 40, provisionalGames: 10 },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function merge(base: NexusConfig, patch: Record<string, unknown>): NexusConfig {
  const out: NexusConfig = structuredClone(base);
  if (typeof patch.dataDir === "string") out.dataDir = patch.dataDir;
  if (isRecord(patch.site)) {
    if (typeof patch.site.name === "string") out.site.name = patch.site.name;
    if (typeof patch.site.url === "string") out.site.url = patch.site.url;
    if (typeof patch.site.contactEmail === "string")
      out.site.contactEmail = patch.site.contactEmail;
  }
  if (isRecord(patch.event) && typeof patch.event.defaultRounds === "number")
    out.event.defaultRounds = patch.event.defaultRounds;
  if (isRecord(patch.pairing) && typeof patch.pairing.priority === "string") {
    const p = patch.pairing.priority;
    if (p !== "record" && p !== "avoid-rematch")
      throw new Error(`config: pairing.priority must be "record" or "avoid-rematch", got "${p}".`);
    out.pairing.priority = p;
  }
  if (isRecord(patch.elo)) {
    const e = patch.elo;
    if (typeof e.base === "number") out.elo.base = e.base;
    if (typeof e.k === "number") out.elo.k = e.k;
    if (typeof e.provisionalK === "number") out.elo.provisionalK = e.provisionalK;
    if (typeof e.provisionalGames === "number") out.elo.provisionalGames = e.provisionalGames;
  }
  return out;
}

function validate(cfg: NexusConfig): NexusConfig {
  if (!Number.isInteger(cfg.event.defaultRounds) || cfg.event.defaultRounds < 1)
    throw new Error("config: event.defaultRounds must be a positive integer.");
  for (const [key, value] of [
    ["elo.k", cfg.elo.k],
    ["elo.provisionalK", cfg.elo.provisionalK],
  ] as const) {
    if (!(value > 0)) throw new Error(`config: ${key} must be greater than 0.`);
  }
  if (cfg.elo.provisionalGames < 0)
    throw new Error("config: elo.provisionalGames cannot be negative.");
  return cfg;
}

let cached: NexusConfig | null = null;

export function loadConfig(): NexusConfig {
  if (cached) return cached;
  const explicit = process.env.NEXUS_CONFIG;
  const candidates = explicit ? [explicit] : ["./nexus.config.json"];
  let cfg = DEFAULTS;
  let loadedFrom: string | null = null;
  for (const c of candidates) {
    const p = isAbsolute(c) ? c : resolve(/* turbopackIgnore: true */ process.cwd(), c);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`config: ${p} is not valid JSON — ${(e as Error).message}`);
    }
    if (!isRecord(parsed)) throw new Error(`config: ${p} must contain a JSON object.`);
    cfg = merge(DEFAULTS, parsed);
    loadedFrom = p;
    break;
  }
  if (explicit && !loadedFrom)
    throw new Error(`config: NEXUS_CONFIG points at ${explicit}, which does not exist.`);

  // Env overrides win over the file, for container-style deploys.
  if (process.env.NEXUS_DATA_DIR) cfg.dataDir = process.env.NEXUS_DATA_DIR;
  if (process.env.NEXUS_SITE_URL) cfg.site.url = process.env.NEXUS_SITE_URL;

  cfg.dataDir = isAbsolute(cfg.dataDir)
    ? cfg.dataDir
    : resolve(/* turbopackIgnore: true */ process.cwd(), cfg.dataDir);
  cached = validate(cfg);
  return cached;
}

/** Test helper: forget the cached config so a new one is read. */
export function resetConfigCache(): void {
  cached = null;
}
