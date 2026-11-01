/**
 * Pairing sanity checker. Runs whole simulated events through the real pairing
 * engine and reports anything degenerate.
 *
 *   npm run simulate                     # default sweep
 *   npm run simulate -- 2-40 --trials=200 --rounds=3
 *
 * Reports, per field size: forced rematches, worst byes handed to one player,
 * and how many players finish undefeated (which is why 3 rounds does not crown
 * a single winner past 8 players).
 */
import {
  pairRound,
  type PairingPlayer,
  type PairingPriority,
} from "../src/lib/domain/pairing";

interface Args {
  from: number;
  to: number;
  trials: number;
  rounds: number;
  priority: PairingPriority;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { from: 2, to: 24, trials: 120, rounds: 3, priority: "record" };
  for (const a of argv) {
    if (a === "--priority=avoid-rematch") {
      out.priority = "avoid-rematch";
      continue;
    }
    if (a === "--priority=record") {
      out.priority = "record";
      continue;
    }
    const range = /^(\d+)-(\d+)$/.exec(a);
    if (range) {
      out.from = Number(range[1]);
      out.to = Number(range[2]);
      continue;
    }
    const single = /^(\d+)$/.exec(a);
    if (single) {
      out.from = out.to = Number(single[1]);
      continue;
    }
    const kv = /^--(\w+)=(\d+)$/.exec(a);
    if (kv) {
      const key = kv[1] as "from" | "to" | "trials" | "rounds";
      if (key in out) out[key] = Number(kv[2]);
    }
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runEvent(n: number, rounds: number, seed: number, priority: PairingPriority) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const pts = new Map(ids.map((i) => [i, 0]));
  const opps = new Map(ids.map((i) => [i, [] as string[]]));
  const byes = new Map(ids.map((i) => [i, 0]));
  const rand = mulberry32(seed);
  let rematches = 0;
  let unpaired = 0;
  let crossRecord = 0;

  for (let r = 1; r <= rounds; r++) {
    const input: PairingPlayer[] = ids.map((id) => ({
      userId: id,
      matchPoints: pts.get(id)!,
      opponents: opps.get(id)!,
      byes: byes.get(id)!,
    }));
    const out = pairRound(input, { seed: seed + r, policy: { priority } });
    const seen = new Set<string>();
    for (const p of out.pairs) {
      seen.add(p.a);
      seen.add(p.b);
      if (p.rematch) rematches++;
      if (pts.get(p.a) !== pts.get(p.b)) crossRecord++;
      opps.get(p.a)!.push(p.b);
      opps.get(p.b)!.push(p.a);
      const winner = rand() < 0.5 ? p.a : p.b;
      pts.set(winner, pts.get(winner)! + 3);
    }
    if (out.bye) {
      seen.add(out.bye);
      byes.set(out.bye, byes.get(out.bye)! + 1);
      pts.set(out.bye, pts.get(out.bye)! + 3);
    }
    if (seen.size !== n) unpaired++;
  }
  const maxPts = rounds * 3;
  return {
    rematches,
    crossRecord,
    maxByes: Math.max(0, ...byes.values()),
    unpaired,
    undefeated: ids.filter((i) => pts.get(i) === maxPts).length,
  };
}

const args = parseArgs(process.argv.slice(2));
console.log(
  `Swiss pairing probe — ${args.rounds} rounds, ${args.trials} trials per field size, ` +
    `priority=${args.priority}\n` +
    `${"n".padStart(4)} ${"rematch".padStart(8)} ${"crossRec".padStart(9)} ${"maxByes".padStart(8)} ` +
    `${"unpaired".padStart(9)}  undefeated`,
);

let problems = 0;
for (let n = args.from; n <= args.to; n++) {
  let rematches = 0;
  let crossRecord = 0;
  let maxByes = 0;
  let unpaired = 0;
  const undef = new Map<number, number>();
  for (let t = 0; t < args.trials; t++) {
    const r = runEvent(n, args.rounds, 1000 + t * 31, args.priority);
    rematches += r.rematches;
    crossRecord += r.crossRecord;
    maxByes = Math.max(maxByes, r.maxByes);
    unpaired += r.unpaired;
    undef.set(r.undefeated, (undef.get(r.undefeated) ?? 0) + 1);
  }
  const dist = [...undef.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  const flag = unpaired > 0 || maxByes > 1 ? "  <-- CHECK" : "";
  if (flag) problems++;
  console.log(
    `${String(n).padStart(4)} ${String(rematches).padStart(8)} ${String(crossRecord).padStart(9)} ` +
      `${String(maxByes).padStart(8)} ${String(unpaired).padStart(9)}  ${dist}${flag}`,
  );
}

console.log(
  problems === 0
    ? `\nAll clear: no second byes, nobody left unpaired.\n` +
        (args.priority === "record"
          ? "rematch counts above are the price of strict record-pairing; crossRec should be\n" +
            "the minimum the record group sizes allow. Compare with --priority=avoid-rematch."
          : "crossRec counts above are the price of avoiding rematches.")
    : `\n${problems} field size(s) flagged above.`,
);
