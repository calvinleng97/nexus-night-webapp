import { join } from "node:path";
import { loadConfig } from "../config";

export function dataRoot(): string {
  return loadConfig().dataDir;
}

export const paths = {
  root: () => dataRoot(),
  locks: () => join(dataRoot(), ".locks"),
  meta: () => join(dataRoot(), "meta.json"),

  usersDir: () => join(dataRoot(), "users"),
  user: (id: string) => join(dataRoot(), "users", `${id}.json`),

  leaguesDir: () => join(dataRoot(), "leagues"),
  league: (id: string) => join(dataRoot(), "leagues", `${id}.json`),

  eventsDir: () => join(dataRoot(), "events"),
  event: (id: string) => join(dataRoot(), "events", `${id}.json`),
  /** Append-only per-event history: every submission, confirm and override. */
  eventLog: (id: string) => join(dataRoot(), "events", id, "matches.jsonl"),
  /** Append-only global audit trail across all leagues and events. */
  audit: () => join(dataRoot(), "log", "audit.jsonl"),
};
