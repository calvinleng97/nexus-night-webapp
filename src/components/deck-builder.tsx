"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_STATE } from "@/app/action-state";
import { addDeckAction, updateDeckAction } from "@/app/actions";
import type { PoolCard } from "@/lib/domain/card-pool";
import {
  BATTLEFIELDS,
  COPIES_MAX,
  canChampion,
  checkBuild,
  fitsLegend,
  legendChampion,
  type Build,
} from "@/lib/domain/deck-rules";
import { ActionMessages } from "./action-form";
import { CardLightbox, FloatingCard, place, type Pos } from "./card-preview";
import { btn, inputClass } from "./ui";

type Counts = Record<string, number>;

export interface BuilderStart {
  name: string;
  legend: string | null;
  champion: string | null;
  main: Counts;
  battlefields: Counts;
  runes: Counts;
  sideboard: Counts;
}

type Kind = "all" | "unit" | "spell" | "gear" | "champion" | "signature" | "battlefield" | "rune";
const KINDS: Array<[Kind, string]> = [
  ["all", "All"],
  ["unit", "Units"],
  ["spell", "Spells"],
  ["gear", "Gear"],
  ["champion", "Champions"],
  ["signature", "Signature"],
  ["battlefield", "Battlefields"],
  ["rune", "Runes"],
];
const COSTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function matchesKind(c: PoolCard, k: Kind): boolean {
  switch (k) {
    case "all":
      return true;
    case "unit":
      return /Unit/.test(c.type);
    case "spell":
      return /Spell/.test(c.type);
    case "gear":
      return /Gear/.test(c.type);
    case "champion":
      return c.champion;
    case "signature":
      return c.signature;
    case "battlefield":
      return c.slot === "battlefield";
    case "rune":
      return c.slot === "rune";
  }
}

const sum = (c: Counts) => Object.values(c).reduce((n, x) => n + x, 0);

/** The decklist text the parser reads back — the same format RiftAtlas uses. */
function toSource(s: BuilderStart): string {
  const lines = (c: Counts) =>
    Object.entries(c)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, n]) => `${n} ${name}`);
  const parts: string[] = [];
  if (s.legend) parts.push(`Legend:\n1 ${s.legend}`);
  if (s.champion) parts.push(`Champion:\n1 ${s.champion}`);
  const sections: Array<[string, Counts]> = [
    ["MainDeck", s.main],
    ["Battlefields", s.battlefields],
    ["Runes", s.runes],
    ["Sideboard", s.sideboard],
  ];
  for (const [header, c] of sections) if (sum(c) > 0) parts.push(`${header}:\n${lines(c).join("\n")}`);
  return parts.join("\n\n");
}

/** Hover a card with a mouse to see it big beside the pointer's target. */
function useHoverCard() {
  const [hover, setHover] = useState<{ card: PoolCard; pos: Pos } | null>(null);
  useEffect(() => {
    if (!hover) return;
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [hover]);
  const bind = (card: PoolCard) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && card.image)
        setHover({ card, pos: place(e.currentTarget.getBoundingClientRect(), card.landscape) });
    },
    onPointerLeave: () => setHover(null),
  });
  return { hover, bind, clear: () => setHover(null) };
}

/**
 * The visual deck editor. Pick a Legend from its art; the pool narrows to what
 * that Legend can play; tap a card to add it, and watch the deck panel's
 * checks turn green as it comes together. Saving writes an ordinary decklist
 * through the same actions as pasting one, so versions and event
 * registrations behave exactly as they do for a paste.
 */
export function DeckBuilder({
  pool,
  start,
  deckId,
}: {
  pool: PoolCard[];
  start: BuilderStart;
  /** Null when building a new deck. */
  deckId: string | null;
}) {
  const byName = useMemo(() => new Map(pool.map((c) => [c.name, c])), [pool]);
  const [deck, setDeck] = useState<BuilderStart>(start);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [cost, setCost] = useState<number | null>(null);
  const [target, setTarget] = useState<"main" | "sideboard">("main");
  const [tab, setTab] = useState<"cards" | "deck">("cards");
  const [inspect, setInspect] = useState<PoolCard | null>(null);
  const [pickingLegend, setPickingLegend] = useState(start.legend === null);
  const { hover, bind, clear } = useHoverCard();
  const [state, formAction, pending] = useActionState(deckId ? updateDeckAction : addDeckAction, EMPTY_STATE);

  const legend = deck.legend ? (byName.get(deck.legend) ?? null) : null;
  const champ = legendChampion(legend);

  // --------------------------------------------------------------- editing

  const copiesOf = (name: string) => (deck.main[name] ?? 0) + (deck.champion === name ? 1 : 0);

  function add(c: PoolCard, to: "main" | "sideboard" = target) {
    // The Legend search shouldn't carry over and filter the card pool.
    if (c.slot === "legend") setQuery("");
    setDeck((d) => {
      const next = { ...d, main: { ...d.main }, sideboard: { ...d.sideboard }, battlefields: { ...d.battlefields }, runes: { ...d.runes } };
      if (c.slot === "legend") {
        next.legend = c.name;
        setPickingLegend(false);
        return next;
      }
      if (c.slot === "battlefield") {
        if (next.battlefields[c.name]) delete next.battlefields[c.name];
        else if (sum(next.battlefields) < BATTLEFIELDS) next.battlefields[c.name] = 1;
        return next;
      }
      if (c.slot === "rune") {
        next.runes[c.name] = (next.runes[c.name] ?? 0) + 1;
        return next;
      }
      if (to === "sideboard") {
        if ((next.sideboard[c.name] ?? 0) < COPIES_MAX) next.sideboard[c.name] = (next.sideboard[c.name] ?? 0) + 1;
        return next;
      }
      // The first fitting Champion Unit fills the Chosen Champion slot.
      if (!next.champion && canChampion(c, legend)) {
        next.champion = c.name;
        return next;
      }
      const have = (next.main[c.name] ?? 0) + (next.champion === c.name ? 1 : 0);
      if (have < COPIES_MAX) next.main[c.name] = (next.main[c.name] ?? 0) + 1;
      return next;
    });
  }

  function remove(name: string, from: "main" | "sideboard" | "battlefields" | "runes" | "champion") {
    setDeck((d) => {
      if (from === "champion") return { ...d, champion: null };
      const section = { ...d[from] };
      section[name] = (section[name] ?? 0) - 1;
      if (section[name]! <= 0) delete section[name];
      return { ...d, [from]: section };
    });
  }

  // ------------------------------------------------------------------ pool

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((c) => {
      if (pickingLegend || !legend) return c.slot === "legend" && (!q || c.name.toLowerCase().includes(q));
      if (c.slot === "legend") return false;
      if (!fitsLegend(c, legend)) return false;
      if (!matchesKind(c, kind)) return false;
      if (cost !== null && (c.energy === null || (cost === 7 ? c.energy < 7 : c.energy !== cost))) return false;
      if (q && !`${c.name} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pool, query, kind, cost, legend, pickingLegend]);

  // ---------------------------------------------------------------- checks

  const build: Build = {
    legend,
    champion: deck.champion ? (byName.get(deck.champion) ?? null) : null,
    main: rowsOf(deck.main),
    battlefields: rowsOf(deck.battlefields),
    runes: rowsOf(deck.runes),
    sideboard: rowsOf(deck.sideboard),
  };
  function rowsOf(c: Counts) {
    return Object.entries(c).flatMap(([name, count]) => {
      const card = byName.get(name);
      return card ? [{ card, count }] : [];
    });
  }
  const checks = checkBuild(build);
  const counters = checks.filter((c) => c.detail);
  const problems = checks.filter((c) => !c.detail && !c.ok);
  const mainTotal = sum(deck.main) + (deck.champion ? 1 : 0);

  // ------------------------------------------------------------------ view

  const inDeck = (c: PoolCard) =>
    c.slot === "battlefield"
      ? (deck.battlefields[c.name] ?? 0)
      : c.slot === "rune"
        ? (deck.runes[c.name] ?? 0)
        : target === "sideboard"
          ? (deck.sideboard[c.name] ?? 0)
          : copiesOf(c.name);

  const tile = (c: PoolCard) => {
    const n = pickingLegend || !legend ? (deck.legend === c.name ? 1 : 0) : inDeck(c);
    const full = c.slot === "main" && n >= COPIES_MAX;
    return (
      <li key={c.name} className="relative">
        <button
          type="button"
          onClick={() => (window.matchMedia("(pointer: coarse)").matches ? setInspect(c) : add(c))}
          {...bind(c)}
          aria-label={`Add ${c.name}`}
          className={`relative block w-full overflow-hidden rounded-[6%] bg-raised ring-1 transition ${
            c.landscape ? "aspect-[1039/744]" : "aspect-[744/1039]"
          } ${n > 0 ? "ring-2 ring-accent" : "ring-white/5 hover:ring-accent/40"} ${full ? "opacity-50" : ""}`}
        >
          {c.image ? (
            <Image src={c.image} alt={c.name} fill sizes="(min-width: 1024px) 130px, 30vw" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-end p-2 text-left text-xs text-fg-dim">{c.name}</span>
          )}
          {n > 0 ? (
            <span className="absolute right-1.5 top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-xs font-bold tabular-nums text-ink">
              {n}
            </span>
          ) : null}
          {c.banned ? (
            <span className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-loss px-1.5 py-0.5 text-center text-[0.6rem] font-bold uppercase text-ink">
              Banned
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  const rowList = (title: string, from: "main" | "sideboard" | "battlefields" | "runes", c: Counts) => {
    const rows = rowsOf(c).sort(
      (a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99) || a.card.name.localeCompare(b.card.name),
    );
    if (rows.length === 0) return null;
    return (
      <section>
        <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold">
          {title}
          <span className="font-mono text-xs font-normal tabular-nums text-fg-faint">{sum(c)}</span>
        </h3>
        <ul className="space-y-1">
          {rows.map(({ card, count }) => (
            <li key={card.name} {...bind(card)} className="flex items-center gap-2 rounded-lg bg-ink/60 py-1 pl-1 pr-1.5">
              <span className="relative h-8 w-11 shrink-0 overflow-hidden rounded-md bg-raised">
                {card.image ? (
                  <Image src={card.image} alt="" fill sizes="44px" className="scale-[1.4] object-cover object-[50%_25%]" />
                ) : null}
              </span>
              {card.energy !== null ? (
                <span className="w-4 text-center font-mono text-xs tabular-nums text-fg-faint">{card.energy}</span>
              ) : null}
              <span className={`min-w-0 flex-1 truncate text-sm ${fitsLegend(card, legend) && !card.banned ? "" : "text-loss"}`}>
                {card.name}
              </span>
              <button type="button" aria-label={`Remove a ${card.name}`} onClick={() => remove(card.name, from)} className="size-7 rounded-md text-fg-dim hover:bg-raised hover:text-fg">
                −
              </button>
              <span className="w-4 text-center font-mono text-sm font-semibold tabular-nums">{count}</span>
              <button
                type="button"
                aria-label={`Add a ${card.name}`}
                onClick={() => add(card, from === "sideboard" ? "sideboard" : "main")}
                className="size-7 rounded-md text-fg-dim hover:bg-raised hover:text-fg"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  const championCard = deck.champion ? (byName.get(deck.champion) ?? null) : null;
  // Cards the pool doesn't know (a typo'd paste, a set newer than the last
  // sync) are kept and saved as they are — listed here so nothing vanishes.
  const unknown = (["main", "battlefields", "runes", "sideboard"] as const).flatMap((from) =>
    Object.entries(deck[from])
      .filter(([name]) => !byName.has(name))
      .map(([name, count]) => [name, from, count] as const),
  );
  const panel = (
    <div className="space-y-5">
      {/* Counters: green when right. */}
      <ul className="flex flex-wrap gap-1.5">
        {counters.map((c) => (
          <li
            key={c.id}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              c.ok ? "border-win/30 bg-win/10 text-win" : "border-hair bg-raised text-fg-dim"
            }`}
          >
            {c.label} <span className="font-mono tabular-nums">{c.detail}</span>
          </li>
        ))}
      </ul>
      {problems.length ? (
        <ul className="space-y-1">
          {problems.map((p) => (
            <li key={p.id} className="text-xs text-loss">
              {p.id === "legend"
                ? "Pick a Legend"
                : p.id === "champion" && !deck.champion
                  ? `Pick a Chosen Champion${champ ? ` (${champ})` : ""}`
                  : p.label}
            </li>
          ))}
        </ul>
      ) : null}

      {legend ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">Legend</h3>
          <div className="flex items-center gap-2 rounded-lg bg-ink/60 p-1 pr-2" {...bind(legend)}>
            <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-raised">
              {legend.image ? <Image src={legend.image} alt="" fill sizes="56px" className="object-cover object-[50%_24%]" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-accent">{legend.name}</span>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPickingLegend(true);
                setTab("cards");
              }}
              className={btn("ghost", "sm")}
            >
              Change
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Chosen Champion</h3>
        {championCard ? (
          <div className="flex items-center gap-2 rounded-lg bg-ink/60 py-1 pl-1 pr-1.5" {...bind(championCard)}>
            <span className="relative h-8 w-11 shrink-0 overflow-hidden rounded-md bg-raised">
              {championCard.image ? <Image src={championCard.image} alt="" fill sizes="44px" className="scale-[1.4] object-cover object-[50%_25%]" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{championCard.name}</span>
            <button type="button" aria-label="Clear the Chosen Champion" onClick={() => remove(championCard.name, "champion")} className="size-7 rounded-md text-fg-dim hover:bg-raised hover:text-fg">
              −
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setKind("champion");
              setTab("cards");
            }}
            className="w-full rounded-lg border border-dashed border-hair px-3 py-2 text-left text-sm text-fg-dim hover:border-accent/40 hover:text-fg"
          >
            {champ ? `Pick ${champ}` : "Pick a champion"}
          </button>
        )}
      </section>

      {unknown.length ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-draw">Not in the card pool</h3>
          <ul className="space-y-1">
            {unknown.map(([name, from, count]) => (
              <li key={`${from}-${name}`} className="flex items-center gap-2 rounded-lg bg-ink/60 py-1 pl-2.5 pr-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-fg-dim">{name}</span>
                <span className="font-mono text-sm tabular-nums">{count}</span>
                <button type="button" aria-label={`Remove a ${name}`} onClick={() => remove(name, from)} className="size-7 rounded-md text-fg-dim hover:bg-raised hover:text-fg">
                  −
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rowList("Main deck", "main", deck.main)}
      {rowList("Battlefields", "battlefields", deck.battlefields)}
      {rowList("Runes", "runes", deck.runes)}
      {rowList("Sideboard", "sideboard", deck.sideboard)}
    </div>
  );

  return (
    <form action={formAction} className="pb-24 sm:pb-0">
      {deckId ? <input type="hidden" name="deckId" value={deckId} /> : null}
      <input type="hidden" name="source" value={toSource(deck)} />

      {/* Name and save: always in reach. */}
      <div className="sticky top-14 z-10 -mx-4 mb-5 flex items-center gap-2 border-b border-hair-soft bg-ink/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        <input
          name="name"
          value={deck.name}
          onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))}
          maxLength={80}
          placeholder={legend ? legend.name : "Deck name"}
          aria-label="Deck name"
          className={`${inputClass} h-10 min-w-0 flex-1 !py-0`}
        />
        <Link href={deckId ? `/decks/${deckId}` : "/decks"} className={btn("ghost", "md")}>
          Cancel
        </Link>
        <button type="submit" disabled={pending || !legend} className={btn("solid", "md")}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <ActionMessages state={state} />

      {/* Phones: one pane at a time. */}
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-hair-soft bg-ink/60 p-1 lg:hidden">
        {(["cards", "deck"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-medium ${tab === t ? "bg-raised text-fg" : "text-fg-faint"}`}
          >
            {t === "cards" ? "Cards" : `Deck · ${mainTotal}/40`}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6">
        {/* ----------------------------------------------------- pool */}
        <div className={tab === "cards" ? "" : "hidden lg:block"}>
          {pickingLegend || !legend ? (
            <h2 className="mb-3 text-[1.05rem] font-semibold">Pick a Legend</h2>
          ) : (
            <div className="mb-3 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards"
                  aria-label="Search cards"
                  className={`${inputClass} h-10 min-w-0 flex-1 !py-0 text-sm`}
                />
                <div className="flex shrink-0 gap-0.5 rounded-xl border border-hair-soft bg-ink/60 p-1" role="radiogroup" aria-label="Add to">
                  {(["main", "sideboard"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={target === t}
                      onClick={() => setTarget(t)}
                      className={`rounded-lg px-2.5 text-xs font-medium ${target === t ? "bg-raised text-fg" : "text-fg-faint"}`}
                    >
                      {t === "main" ? "Main" : "Side"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={`h-7 rounded-full border px-2.5 text-xs font-medium ${
                      kind === k ? "border-accent/50 bg-accent/15 text-accent" : "border-hair text-fg-dim hover:text-fg"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg-faint">Cost</span>
                {COSTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={cost === n}
                    onClick={() => setCost(cost === n ? null : n)}
                    className={`size-7 rounded-full border font-mono text-xs tabular-nums ${
                      cost === n ? "border-accent/50 bg-accent/15 text-accent" : "border-hair text-fg-dim hover:text-fg"
                    }`}
                  >
                    {n === 7 ? "7+" : n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pickingLegend || !legend ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Legends"
              aria-label="Search Legends"
              className={`${inputClass} mb-3 h-10 !py-0 text-sm`}
            />
          ) : null}
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">{shown.map(tile)}</ul>
          {shown.length === 0 ? <p className="py-10 text-center text-sm text-fg-faint">No cards match.</p> : null}
        </div>

        {/* ---------------------------------------------------- deck */}
        <aside className={tab === "deck" ? "" : "hidden lg:block"}>
          <div className="lg:sticky lg:top-36 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-hair-soft lg:bg-surface lg:p-4">
            {panel}
          </div>
        </aside>
      </div>

      {hover?.card.image ? <FloatingCard src={hover.card.image} pos={hover.pos} /> : null}
      {inspect?.image ? (
        <CardLightbox
          src={inspect.image}
          name={inspect.name}
          landscape={inspect.landscape}
          onClose={() => {
            setInspect(null);
            clear();
          }}
          actions={
            <>
              {inspect.slot === "main" && !pickingLegend && legend ? (
                <button type="button" onClick={() => add(inspect, "sideboard")} className={btn("default", "md")}>
                  + Side
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  add(inspect);
                  if (inspect.slot === "legend") setInspect(null);
                }}
                className={btn("primary", "md")}
              >
                {inspect.slot === "legend" ? "Choose" : `+ Add${inDeck(inspect) ? ` (${inDeck(inspect)})` : ""}`}
              </button>
            </>
          }
        />
      ) : null}
    </form>
  );
}
