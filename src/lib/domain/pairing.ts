/**
 * Swiss pairing by minimum-cost perfect matching.
 *
 * WHY NOT GREEDY: the obvious algorithm — walk down the standings and pair each
 * player with the first opponent they have not yet faced — provably strands
 * itself. Verified counterexample at 6 players, round 3, standings
 * [0,4,2,3,1,5] with prior games 0-1, 0-2, 1-4, 2-3, 3-5, 4-5: greedy leaves
 * the final two players as a forced rematch even though a rematch-free pairing
 * of that exact field exists. Same failure occurs at n = 5, 7, 8 and 10.
 *
 * So we score every candidate pairing and solve for the globally cheapest
 * perfect matching instead. Costs are soft, so a pairing ALWAYS exists (worst
 * case an expensive rematch) and the engine can never deadlock — including at
 * n = 2, where rounds 2 and 3 must be rematches.
 *
 * ORDERING IS LEXICOGRAPHIC, NOT WEIGHTED. Rather than hand-tuned penalties
 * that can silently trade one constraint for another, the scale of each term is
 * derived from the field so that a higher-priority term can never be outbid by
 * any accumulation of lower-priority ones:
 *
 *   priority "record" (default)   record gap  >  rematches  >  bye position
 *   priority "avoid-rematch"      rematches   >  record gap >  bye position
 *
 * A second bye outranks everything in both modes, which is always satisfiable
 * for n >= 3. Next comes the bye going to the worst record: it is a hard rule,
 * not a cost, so the solver only chooses among eligible players tied for the
 * lowest record and never hands the bye to a better record to keep
 * groups even.
 */

export interface PairingPlayer {
  userId: string;
  weight: number;
  /** User ids this player has already played (byes excluded). */
  opponents: string[];
  /** Byes already received in this event. */
  byes: number;
}

/**
 * - `record`: pair strictly within records. Players on equal records are
 *   matched whenever the group sizes allow, accepting a rematch if that is what
 *   keeping records together requires.
 * - `avoid-rematch`: never repeat a pairing unless the field makes it
 *   impossible, accepting mismatched records to achieve that.
 */
export type PairingPriority = "record" | "avoid-rematch";

export interface PairingPolicy {
  priority: PairingPriority;
}

export const DEFAULT_POLICY: PairingPolicy = { priority: "record" };

export interface PairingOutcome {
  pairs: Array<{ a: string; b: string; rematch: boolean }>;
  /** User id receiving the bye, or null when the field is even. */
  bye: string | null;
  cost: number;
  /** Human-readable notes about compromises the solver had to make. */
  warnings: string[];
  /** True when an exact optimum was proven, false when a heuristic was used. */
  exact: boolean;
  /** Sum of squared record-weight gaps across the chosen pairs. */
  recordGap: number;
}

/** Exact threshold: bitmask DP is O(2^m * m), fine to about 20 players. */
const EXACT_LIMIT = 20;

interface Scales {
  gap: number;
  rematch: number;
  repeatBye: number;
  byeRank: number;
}

/**
 * Derive cost scales that make the priority ordering strict for this field.
 *
 * With `pairsBound` the most pairs a round can contain, giving the dominant
 * term a multiplier of `pairsBound + 1` guarantees one unit of it exceeds the
 * total of every subordinate unit that could possibly accumulate.
 */
function scalesFor(players: PairingPlayer[], priority: PairingPriority): Scales {
  const m = players.length;
  const pairsBound = Math.floor(m / 2) + 1;
  const weights = players.map((p) => p.weight);
  const maxGap = weights.length > 0 ? Math.max(...weights) - Math.min(...weights) : 0;
  const maxGapSq = Math.max(1, maxGap * maxGap);

  let gap: number;
  let rematch: number;
  if (priority === "record") {
    gap = pairsBound + 1;
    rematch = 1;
  } else {
    gap = 1;
    rematch = pairsBound * maxGapSq + 1;
  }
  const worstRound = pairsBound * (maxGapSq * gap + rematch);
  return {
    gap,
    rematch,
    repeatBye: worstRound + 1,
    // Pure tiebreaker: every bye-rank penalty together stays below one unit of
    // the cheapest real term, so it can only break exact ties.
    byeRank: 1 / (m + 2),
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable standings order: best record first, then by seeded shuffle so
 * that equal records have a deterministic but unbiased order.
 */
export function standingsOrder(players: PairingPlayer[], seed: number): PairingPlayer[] {
  const rand = mulberry32(seed);
  const keyed = players.map((p) => ({ p, k: rand() }));
  keyed.sort((x, y) => y.p.weight - x.p.weight || x.k - y.k);
  return keyed.map((e) => e.p);
}

function metSet(players: PairingPlayer[]): Set<string> {
  const met = new Set<string>();
  for (const p of players) for (const o of p.opponents) met.add(`${p.userId}\u0000${o}`);
  return met;
}

function buildCostMatrix(
  players: PairingPlayer[],
  met: Set<string>,
  scales: Scales,
): Float64Array {
  const m = players.length;
  const cost = new Float64Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const pi = players[i]!;
      const pj = players[j]!;
      const d = pi.weight - pj.weight;
      let c = d * d * scales.gap;
      if (met.has(`${pi.userId}\u0000${pj.userId}`)) c += scales.rematch;
      cost[i * m + j] = c;
      cost[j * m + i] = c;
    }
  }
  return cost;
}

/** Minimum-cost perfect matching over an even number of players, exact. */
function exactMatching(
  m: number,
  cost: Float64Array,
): { pairs: Array<[number, number]>; cost: number } {
  if (m === 0) return { pairs: [], cost: 0 };
  const size = 1 << m;
  const dp = new Float64Array(size).fill(Infinity);
  const choice = new Int32Array(size).fill(-1);
  dp[0] = 0;
  for (let mask = 0; mask < size; mask++) {
    const base = dp[mask]!;
    if (base === Infinity) continue;
    let i = -1;
    for (let k = 0; k < m; k++) {
      if ((mask & (1 << k)) === 0) {
        i = k;
        break;
      }
    }
    if (i === -1) continue;
    for (let j = i + 1; j < m; j++) {
      if ((mask & (1 << j)) !== 0) continue;
      const next = mask | (1 << i) | (1 << j);
      const c = base + cost[i * m + j]!;
      if (c < dp[next]!) {
        dp[next] = c;
        choice[next] = i * m + j;
      }
    }
  }
  const pairs: Array<[number, number]> = [];
  let mask = size - 1;
  while (mask !== 0) {
    const ch = choice[mask]!;
    if (ch < 0) break;
    const i = Math.floor(ch / m);
    const j = ch % m;
    pairs.push([i, j]);
    mask &= ~((1 << i) | (1 << j));
  }
  return { pairs, cost: dp[size - 1]! };
}

/** Heuristic matching for large fields: seeded fold + 2-opt local search. */
function heuristicMatching(
  m: number,
  cost: Float64Array,
  seed: number,
): { pairs: Array<[number, number]>; cost: number } {
  const total = (pairs: Array<[number, number]>) =>
    pairs.reduce((s, [i, j]) => s + cost[i * m + j]!, 0);
  let best: Array<[number, number]> | null = null;
  let bestCost = Infinity;
  for (let restart = 0; restart < 24; restart++) {
    const rand = mulberry32(seed + restart * 7919);
    // Restart 0 keeps standings order, which already pairs adjacent records.
    const idx = Array.from({ length: m }, (_, i) => i);
    if (restart > 0) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = idx[i]!;
        idx[i] = idx[j]!;
        idx[j] = t;
      }
    }
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < m; i += 2) pairs.push([idx[i]!, idx[i + 1]!]);
    let improved = true;
    while (improved) {
      improved = false;
      for (let x = 0; x < pairs.length; x++) {
        for (let y = x + 1; y < pairs.length; y++) {
          const [a, b] = pairs[x]!;
          const [c, d] = pairs[y]!;
          const cur = cost[a * m + b]! + cost[c * m + d]!;
          const alt1 = cost[a * m + c]! + cost[b * m + d]!;
          const alt2 = cost[a * m + d]! + cost[b * m + c]!;
          if (alt1 < cur - 1e-9 && alt1 <= alt2) {
            pairs[x] = [a, c];
            pairs[y] = [b, d];
            improved = true;
          } else if (alt2 < cur - 1e-9) {
            pairs[x] = [a, d];
            pairs[y] = [b, c];
            improved = true;
          }
        }
      }
    }
    const c = total(pairs);
    if (c < bestCost) {
      bestCost = c;
      best = pairs;
    }
  }
  return { pairs: best ?? [], cost: bestCost };
}

function solve(
  players: PairingPlayer[],
  met: Set<string>,
  scales: Scales,
  seed: number,
): { pairs: Array<[number, number]>; cost: number; exact: boolean } {
  const m = players.length;
  const cost = buildCostMatrix(players, met, scales);
  if (m <= EXACT_LIMIT) return { ...exactMatching(m, cost), exact: true };
  return { ...heuristicMatching(m, cost, seed), exact: false };
}

/**
 * Pair one Swiss round.
 *
 * `players` should contain only players still active for this round (dropped
 * players excluded by the caller). Returns pairings plus the bye recipient.
 */
export function pairRound(
  players: PairingPlayer[],
  opts: { seed?: number; policy?: Partial<PairingPolicy> } = {},
): PairingOutcome {
  const policy = { ...DEFAULT_POLICY, ...opts.policy };
  const seed = opts.seed ?? 1;
  const warnings: string[] = [];

  if (players.length === 0)
    return { pairs: [], bye: null, cost: 0, warnings, exact: true, recordGap: 0 };
  if (players.length === 1) {
    const only = players[0]!;
    if (only.byes > 0)
      warnings.push("Single player receives a repeat bye; the field is too small to pair.");
    return { pairs: [], bye: only.userId, cost: 0, warnings, exact: true, recordGap: 0 };
  }

  const ordered = standingsOrder(players, seed);
  const met = metSet(players);
  const isRematch = (a: string, b: string) => met.has(`${a}\u0000${b}`);
  const pointsOf = new Map(players.map((p) => [p.userId, p.weight]));
  const gapOf = (a: string, b: string) => {
    const d = (pointsOf.get(a) ?? 0) - (pointsOf.get(b) ?? 0);
    return d * d;
  };

  const finish = (
    pairs: Array<{ a: string; b: string; rematch: boolean }>,
    bye: string | null,
    cost: number,
    exact: boolean,
  ): PairingOutcome => {
    const rematches = pairs.filter((p) => p.rematch).length;
    const crossRecord = pairs.filter((p) => gapOf(p.a, p.b) > 0).length;
    const notes = [...warnings];
    if (rematches > 0)
      notes.push(
        `${rematches} rematch${rematches > 1 ? "es" : ""} ` +
          (policy.priority === "record"
            ? "needed to keep players on equal records together."
            : "were unavoidable for this field."),
      );
    if (policy.priority === "avoid-rematch" && crossRecord > 0)
      notes.push(
        `${crossRecord} pairing${crossRecord > 1 ? "s" : ""} crossed records to avoid a rematch.`,
      );
    return {
      pairs,
      bye,
      cost,
      warnings: notes,
      exact,
      recordGap: pairs.reduce((s, p) => s + gapOf(p.a, p.b), 0),
    };
  };

  // Even field: one matching over everyone.
  if (ordered.length % 2 === 0) {
    const scales = scalesFor(ordered, policy.priority);
    const { pairs, cost, exact } = solve(ordered, met, scales, seed);
    const out = pairs.map(([i, j]) => {
      const a = ordered[i]!.userId;
      const b = ordered[j]!.userId;
      return { a, b, rematch: isRematch(a, b) };
    });
    return finish(out, null, cost, exact);
  }

  // Odd field: the bye choice and the matching interact, so try each eligible
  // bye recipient and keep the cheapest overall outcome. Eligible means "has
  // not had a bye yet"; if nobody is eligible we fall back to everyone and pay
  // repeatBye, which only happens in fields too small to avoid it.
  const eligible = ordered.filter((p) => p.byes === 0);
  const candidatePool = eligible.length > 0 ? eligible : ordered;
  if (eligible.length === 0)
    warnings.push("Every remaining player has already had a bye; one player must take a second.");

  // The bye always goes to an eligible player on the WORST record. Only among
  // players tied on that record does the matching cost pick who takes it (with
  // standings position as the final tiebreak). For large fields only consider
  // the bottom few candidates to bound the work.
  const worstWeight = Math.min(...candidatePool.map((p) => p.weight));
  const fromBottom = candidatePool.filter((p) => p.weight === worstWeight).reverse();
  const candidates = ordered.length > EXACT_LIMIT ? fromBottom.slice(0, 4) : fromBottom;

  let best: { pairs: Array<{ a: string; b: string; rematch: boolean }>; bye: string; cost: number; exact: boolean } | null =
    null;
  for (const cand of candidates) {
    const rest = ordered.filter((p) => p.userId !== cand.userId);
    const scales = scalesFor(ordered, policy.priority);
    const { pairs, cost, exact } = solve(rest, met, scales, seed);
    const rankIdx = ordered.findIndex((p) => p.userId === cand.userId);
    const byePenalty =
      (ordered.length - 1 - rankIdx) * scales.byeRank + (cand.byes > 0 ? scales.repeatBye : 0);
    const totalCost = cost + byePenalty;
    if (best !== null && totalCost >= best.cost) continue;
    const out = pairs.map(([i, j]) => {
      const a = rest[i]!.userId;
      const b = rest[j]!.userId;
      return { a, b, rematch: isRematch(a, b) };
    });
    best = { pairs: out, bye: cand.userId, cost: totalCost, exact };
  }

  const chosen = best!;
  return finish(chosen.pairs, chosen.bye, chosen.cost, chosen.exact);
}
