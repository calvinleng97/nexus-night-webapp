import { cardImage } from "@/lib/domain/card-images";
import { cardTotal, cardWikiUrl, deckSections } from "@/lib/domain/deck";
import { CardPreview } from "./card-preview";
import { DeckGallery } from "./deck-gallery";
import { DeckViewSwitch } from "./deck-view-switch";
import { deckWatchlist, type WatchCard } from "@/lib/domain/tricks";
import type { DeckCard } from "@/lib/domain/types";
import { MicroLabel } from "./ui";

/**
 * Anything with the five card sections: a saved Deck or the snapshot an event
 * keeps of one. Both render the same way, which is the point — a list you are
 * looking at on the league page is the list that was played.
 */
export interface DeckLike {
  legend: string | null;
  champions: DeckCard[];
  mainDeck: DeckCard[];
  battlefields: DeckCard[];
  runes: DeckCard[];
  sideboard: DeckCard[];
}

/**
 * A card name linked to its League wiki entry, opening in a new tab so a
 * mid-tournament lookup never costs anyone the page they were on. When the
 * card has a known image, hovering shows it and a tap on a phone opens it.
 */
export function CardLink({
  name,
  legend = false,
  className = "",
}: {
  name: string;
  /** Legends sit on the wiki under their title alone, not "Champion, Title". */
  legend?: boolean;
  className?: string;
}) {
  const href = cardWikiUrl(name, { legend });
  const cls = `underline-offset-2 transition-colors hover:text-accent hover:underline ${className}`;
  // Looked up here, on the server, so the card map never ships to the browser.
  const image = cardImage(name, { legend });
  if (image)
    return (
      <CardPreview href={href} name={name} {...image} className={cls}>
        {name}
      </CardPreview>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={`${name} — League wiki`} className={cls}>
      {name}
    </a>
  );
}

function Section({ label, cards }: { label: string; cards: DeckCard[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <MicroLabel>{label}</MicroLabel>
        <span className="font-mono text-[0.7rem] tabular-nums text-fg-faint/70">
          {cardTotal(cards)}
        </span>
      </div>
      <ul className="mt-1.5 font-mono text-[0.78rem] leading-relaxed text-fg-dim">
        {cards.map((c, i) => (
          <li key={`${c.name}-${i}`} className="flex gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums text-fg-faint">{c.count}</span>
            <CardLink name={c.name} className="min-w-0 break-words text-fg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The chip that opens a deck's combat tricks and Hidden cards: a bolt with the
 * trick count, a face-down card with the Hidden count. Only the chip toggles —
 * the rest of the summary row stays an ordinary, clickable Legend link.
 */
function WatchToggle({ tricks, hidden }: { tricks: WatchCard[]; hidden: WatchCard[] }) {
  return (
    <span
      role="button"
      title="Combat tricks & Hidden cards"
      className="pointer-events-auto inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-hair bg-raised px-2 py-1 font-mono text-xs tabular-nums text-fg-dim transition-colors hover:border-accent/40 hover:text-accent group-open/watch:border-accent/40 group-open/watch:text-accent"
    >
      <span className="sr-only">Combat tricks and Hidden cards</span>
      <span aria-hidden className="inline-flex items-center gap-1">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <path d="M9.2 1.5 3.5 9h3.7l-1 5.5L12.5 7H8.7l.5-5.5z" />
        </svg>
        {cardTotal(tricks)}
      </span>
      <span aria-hidden className="inline-flex items-center gap-1">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3.5" y="2" width="9" height="12" rx="1.5" />
          <path d="M6 5.5l4 5M10 5.5l-4 5" strokeLinecap="round" />
        </svg>
        {cardTotal(hidden)}
      </span>
      <svg aria-hidden viewBox="0 0 16 16" className="size-3 transition-transform group-open/watch:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </span>
  );
}

/** A tag small enough to sit inside a line of card text without growing it. */
function MiniTag({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded border px-1 font-sans text-[0.6rem] font-semibold uppercase leading-4 tracking-wider ${
        accent ? "border-accent/35 bg-accent/10 text-accent" : "border-hair bg-raised text-fg-faint"
      }`}
    >
      {children}
    </span>
  );
}

function WatchSection({ label, cards }: { label: string; cards: WatchCard[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <MicroLabel>{label}</MicroLabel>
        <span className="font-mono text-[0.7rem] tabular-nums text-fg-faint/70">
          {cardTotal(cards)}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="mt-1.5 font-mono text-[0.78rem] text-fg-faint">—</p>
      ) : (
        <ul className="mt-1.5 font-mono text-[0.78rem] leading-relaxed text-fg-dim">
          {cards.map((c, i) => (
            <li key={`${c.name}-${i}`} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right tabular-nums text-fg-faint">{c.count}</span>
              <CardLink name={c.name} className="min-w-0 break-words text-fg" />
              {c.speed ? (
                <MiniTag accent={c.speed === "reaction"}>
                  {c.speed === "reaction" ? "Reaction" : "Action"}
                </MiniTag>
              ) : null}
              {c.sideboard ? <MiniTag>Side</MiniTag> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Watchlist({ tricks, hidden }: { tricks: WatchCard[]; hidden: WatchCard[] }) {
  return (
    <div className="mt-3 grid gap-5 rounded-lg border border-accent/20 bg-accent-soft/15 p-3 sm:grid-cols-2">
      <WatchSection label="Combat tricks" cards={tricks} />
      <WatchSection label="Hidden" cards={hidden} />
    </div>
  );
}

/**
 * A decklist, for anyone looking at one: the Legend and its combat-trick /
 * Hidden watchlist on top, then the cards — as card images by default, or as
 * the plain text list (Cards / List, remembered per device).
 *
 * `showLegend={false}` for pages whose header already names the Legend.
 */
export function DeckListing({ deck, showLegend = true }: { deck: DeckLike; showLegend?: boolean }) {
  const sections = deckSections(deck);
  if (sections.length === 0)
    return (
      <p className="text-sm text-fg-faint">
        The cards for this one were not kept — it was registered before lists were recorded, and
        the deck has since been deleted.
      </p>
    );
  const watch = deckWatchlist(deck);
  const hasWatch = watch.tricks.length + watch.hidden.length > 0;
  const legend = showLegend ? deck.legend : null;

  const header =
    legend || hasWatch ? (
      <details className="group/watch">
        <summary className="pointer-events-none flex list-none flex-wrap items-center gap-x-3 gap-y-2">
          {legend ? (
            <span className="min-w-0">
              <MicroLabel>Legend</MicroLabel>
              <span className="pointer-events-auto mt-1 block w-fit text-sm font-medium text-accent">
                <CardLink name={legend} legend />
              </span>
            </span>
          ) : null}
          {hasWatch ? <WatchToggle tricks={watch.tricks} hidden={watch.hidden} /> : null}
        </summary>
        {hasWatch ? <Watchlist tricks={watch.tricks} hidden={watch.hidden} /> : null}
      </details>
    ) : null;

  return (
    <div className="rounded-xl border border-hair-soft bg-ink p-4">
      <DeckViewSwitch
        header={header}
        cards={<DeckGallery deck={deck} />}
        list={
          <div className="grid gap-5 sm:grid-cols-2">
            {sections.map((s) => (
              <Section key={s.key} label={s.label} cards={s.cards} />
            ))}
          </div>
        }
      />
    </div>
  );
}

/**
 * The "this expands" affordance: a list glyph and a chevron that turns when
 * the surrounding <details> (marked `group`) is open. No words, by design.
 */
export function ExpandIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-1 rounded-lg border border-hair bg-raised px-1.5 py-1 text-fg-faint transition-colors group-hover:border-accent/40 group-hover:text-accent group-open:border-accent/40 group-open:text-accent"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
        <circle cx="2.5" cy="4" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="2.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="2.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      </svg>
      <svg viewBox="0 0 16 16" className="size-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </span>
  );
}
