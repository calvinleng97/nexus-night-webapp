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

export function newSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}
