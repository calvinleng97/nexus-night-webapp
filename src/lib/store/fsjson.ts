import { mkdir, readFile, writeFile, rename, appendFile, rm, stat, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Minimal durable JSON/JSONL layer.
 *
 * Writes go to a temp file then rename(2), which is atomic on the same
 * filesystem, so a reader never observes a half-written document. Mutations
 * take an advisory lock first (mkdir(2) is atomic and fails if the directory
 * exists), because Next.js can serve concurrent requests and two players may
 * submit results at the same moment.
 */

const LOCK_STALE_MS = 15_000;
const LOCK_RETRY_MS = 40;
const LOCK_TIMEOUT_MS = 10_000;

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (e instanceof SyntaxError) throw new Error(`Corrupt JSON at ${path}: ${e.message}`);
    throw e;
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export async function appendJsonl(path: string, record: unknown): Promise<void> {
  await ensureDir(dirname(path));
  // O_APPEND writes of a single short line are not interleaved by the kernel.
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readJsonl<T>(path: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: T[] = [];
  for (const [i, line] of raw.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      throw new Error(`Corrupt JSONL at ${path}:${i + 1}`);
    }
  }
  return out;
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => join(dir, e.name));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Run `fn` while holding an exclusive advisory lock on `key`. */
export async function withLock<T>(lockDir: string, key: string, fn: () => Promise<T>): Promise<T> {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  const lockPath = join(lockDir, `${safe}.lock`);
  await ensureDir(lockDir);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    try {
      await mkdir(lockPath);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // Break a lock left behind by a crashed process.
      try {
        const s = await stat(lockPath);
        if (Date.now() - s.mtimeMs > LOCK_STALE_MS) {
          await rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for lock on ${key}. Remove ${lockPath} if stale.`);
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
