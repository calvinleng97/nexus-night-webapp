import { cardTotal, cardWikiUrl, deckSections, hasCardList } from "@/lib/domain/deck";
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
 * mid-tournament lookup never costs anyone the page they were on.
 */
export function CardLink({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <a
      href={cardWikiUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name} — League wiki`}
      className={`underline-offset-2 transition-colors hover:text-accent hover:underline ${className}`}
    >
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

/** The full list, laid out by section. Plain text, so it can be copied out. */
export function DeckListing({ deck }: { deck: DeckLike }) {
  const sections = deckSections(deck);
  if (sections.length === 0)
    return (
      <p className="text-sm text-fg-faint">
        The cards for this one were not kept — it was registered before lists were recorded, and
        the deck has since been deleted.
      </p>
    );
  return (
    <div className="rounded-xl border border-hair-soft bg-ink p-4">
      {deck.legend ? (
        <div className="mb-4 border-b border-hair-soft pb-3">
          <MicroLabel>Legend</MicroLabel>
          <p className="mt-1 text-sm font-medium text-accent">
            <CardLink name={deck.legend} />
          </p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {sections.map((s) => (
          <Section key={s.key} label={s.label} cards={s.cards} />
        ))}
      </div>
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

/**
 * A collapsed full list, opened from a small icon button. `label` is only for
 * screen readers. Decks whose cards were never recorded show nothing.
 */
export function DeckDisclosure({
  deck,
  label = "Decklist",
}: {
  deck: DeckLike;
  label?: string;
}) {
  if (!hasCardList(deck)) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none" title={label}>
        <span className="sr-only">{label}</span>
        <ExpandIcon />
      </summary>
      <div className="mt-2.5">
        <DeckListing deck={deck} />
      </div>
    </details>
  );
}
