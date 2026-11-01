import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // no l/1/0/o

export function newId(prefix: string, length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `${prefix}_${out}`;
}

/** Stable user id derived from Google's subject claim. */
export function userIdFromGoogleSub(sub: string): string {
  const h = createHash("sha256").update(`google:${sub}`).digest("hex");
  return `u_${h.slice(0, 16)}`;
}

/**
 * Join-code alphabet. Upper case, with I, L, O, 0 and 1 left out so a code
 * read aloud or copied off a phone screen cannot be mistyped.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newJoinCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

/** Accept what someone actually types: any case, with spaces or dashes. */
export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function newSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}
