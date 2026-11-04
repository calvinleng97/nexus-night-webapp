/**
 * What makes a Riftbound deck legal, as checks the deck editor shows while you
 * build. They never stop you saving: a half-built brew is still worth keeping.
 *
 * Read off real lists: the Chosen Champion plus the main deck make 40 cards,
 * other champions' units may sit in the main deck, Signature cards and the
 * Chosen Champion belong to the Legend's champion, every card must fit within
 * the Legend's domains (Battlefields have none), and a deck runs 3 different
 * Battlefields, 12 Runes, at most 10 sideboard cards and 3 copies of a card.
 */

export const MAIN_SIZE = 40;
export const RUNES = 12;
export const BATTLEFIELDS = 3;
export const SIDEBOARD_MAX = 10;
export const COPIES_MAX = 3;

/** The few facts about a card the rules need. */
export interface RuleCard {
  name: string;
  domains: string[];
  tags: string[];
  signature: boolean;
  champion: boolean;
  banned: boolean;
}

export interface Build {
  legend: (RuleCard & { tags: string[] }) | null;
  champion: RuleCard | null;
  main: Array<{ card: RuleCard; count: number }>;
  battlefields: Array<{ card: RuleCard; count: number }>;
  runes: Array<{ card: RuleCard; count: number }>;
  sideboard: Array<{ card: RuleCard; count: number }>;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  /** "38 / 40", for the counters. */
  detail?: string;
}

/** The champion a Legend belongs to: its first tag ("Azir"). */
export function legendChampion(legend: { tags: string[] } | null): string | null {
  return legend?.tags[0] ?? null;
}

/**
 * Whether a card can go in a deck led by this Legend: within its domains,
 * and — for Signature cards — that champion's own.
 */
export function fitsLegend(card: RuleCard, legend: { domains: string[]; tags: string[] } | null): boolean {
  if (!legend) return true;
  if (!card.domains.every((d) => legend.domains.includes(d))) return false;
  if (card.signature && !card.tags.includes(legendChampion(legend) ?? "")) return false;
  return true;
}

/** Whether a card can be this Legend's Chosen Champion. */
export function canChampion(card: RuleCard, legend: { tags: string[] } | null): boolean {
  return card.champion && (!legend || card.tags.includes(legendChampion(legend) ?? ""));
}

const total = (xs: Array<{ count: number }>) => xs.reduce((n, x) => n + x.count, 0);

export function checkBuild(b: Build): Check[] {
  const main = total(b.main) + (b.champion ? 1 : 0);
  const runes = total(b.runes);
  const side = total(b.sideboard);

  const copies = new Map<string, number>();
  for (const { card, count } of [...b.main, ...(b.champion ? [{ card: b.champion, count: 1 }] : [])])
    copies.set(card.name, (copies.get(card.name) ?? 0) + count);
  const overCopies = [...copies].filter(([, n]) => n > COPIES_MAX).map(([name]) => name);

  const everything = [...b.main, ...b.sideboard, ...b.runes, ...b.battlefields].map((x) => x.card);
  if (b.champion) everything.push(b.champion);
  const offLegend = b.legend ? everything.filter((c) => !fitsLegend(c, b.legend)).map((c) => c.name) : [];
  const banned = everything.filter((c) => c.banned).map((c) => c.name);
  const repeatedField = b.battlefields.some((x) => x.count > 1);

  const checks: Check[] = [
    { id: "legend", label: "Legend", ok: b.legend !== null },
    {
      id: "champion",
      label: "Chosen Champion",
      ok: b.champion !== null && canChampion(b.champion, b.legend),
    },
    { id: "main", label: "Main deck", ok: main === MAIN_SIZE, detail: `${main} / ${MAIN_SIZE}` },
    {
      id: "battlefields",
      label: "Battlefields",
      ok: total(b.battlefields) === BATTLEFIELDS && !repeatedField,
      detail: `${total(b.battlefields)} / ${BATTLEFIELDS}`,
    },
    { id: "runes", label: "Runes", ok: runes === RUNES, detail: `${runes} / ${RUNES}` },
    { id: "sideboard", label: "Sideboard", ok: side <= SIDEBOARD_MAX, detail: `${side} / ${SIDEBOARD_MAX}` },
  ];
  if (overCopies.length)
    checks.push({ id: "copies", label: `More than ${COPIES_MAX}: ${overCopies.join(", ")}`, ok: false });
  if (offLegend.length)
    checks.push({ id: "domains", label: `Outside the Legend: ${offLegend.join(", ")}`, ok: false });
  if (banned.length) checks.push({ id: "banned", label: `Banned: ${banned.join(", ")}`, ok: false });
  return checks;
}
