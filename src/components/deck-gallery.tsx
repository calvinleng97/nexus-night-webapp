import Image from "next/image";
import { cardImage } from "@/lib/domain/card-images";
import { cardTotal, cardWikiUrl, deckSections } from "@/lib/domain/deck";
import type { ReactNode } from "react";
import type { WatchCard } from "@/lib/domain/tricks";
import type { DeckCard } from "@/lib/domain/types";
import { CardPreview } from "./card-preview";
import type { DeckLike } from "./deck-view";

/**
 * A deck's Legend as artwork: the card's illustration, cropped to a banner.
 * Every deck already has a face — this just shows it.
 */
export function DeckArt({
  legend,
  className = "",
  sizes = "(min-width: 768px) 720px, 100vw",
}: {
  legend: string | null;
  className?: string;
  sizes?: string;
}) {
  const image = legend ? cardImage(legend, { legend: true }) : null;
  return (
    <div aria-hidden className={`relative overflow-hidden bg-raised ${className}`}>
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          sizes={sizes}
          // The illustration sits in the top half of a Legend card.
          className="object-cover object-[50%_24%]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent-soft/60 to-surface" />
      )}
      {/* Fade into the surface below so text over the bottom edge reads. */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
    </div>
  );
}

/** "6 Calm · 6 Order": the domains a deck runs, read off its runes. */
export function RuneSplit({ runes }: { runes: DeckCard[] }) {
  if (runes.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {runes.map((r) => (
        <span
          key={r.name}
          className="inline-flex items-center gap-1 rounded-full border border-hair bg-ink/60 px-2 py-0.5 text-xs text-fg-dim backdrop-blur"
        >
          <span className="font-mono font-semibold tabular-nums text-fg">{r.count}</span>
          {r.name.replace(/\s+Rune$/i, "")}
        </span>
      ))}
    </span>
  );
}

/** A label that sits on a card's art: dark glass, so it reads on any art. */
function ArtTag({ children, tone = "plain" }: { children: string; tone?: "plain" | "accent" }) {
  return (
    <span
      className={`rounded-md bg-ink/85 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase leading-none tracking-wider ring-1 backdrop-blur ${
        tone === "accent" ? "text-accent ring-accent/40" : "text-fg-dim ring-white/15"
      }`}
    >
      {children}
    </span>
  );
}

function Tile({ card, tags }: { card: DeckCard; tags?: ReactNode }) {
  const image = cardImage(card.name);
  const href = cardWikiUrl(card.name);
  const badge = (
    <>
      <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink/90 px-1.5 font-mono text-xs font-bold tabular-nums text-fg ring-1 ring-white/15">
        ×{card.count}
      </span>
      {tags ? <span className="absolute inset-x-1.5 bottom-1.5 z-10 flex flex-wrap gap-1">{tags}</span> : null}
    </>
  );

  if (!image)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex aspect-[744/1039] items-end rounded-[6%] border border-dashed border-hair bg-raised p-2 text-xs text-fg-dim transition-colors hover:border-accent/40 hover:text-fg"
      >
        {badge}
        {card.name}
      </a>
    );

  return (
    <CardPreview
      href={href}
      name={card.name}
      {...image}
      className={`relative block overflow-hidden rounded-[6%] bg-raised ring-1 ring-white/5 transition-transform hover:-translate-y-0.5 hover:ring-accent/40 ${
        image.landscape ? "aspect-[1039/744]" : "aspect-[744/1039]"
      }`}
    >
      <Image
        src={image.src}
        alt={card.name}
        fill
        loading="lazy"
        sizes={image.landscape ? "(min-width: 640px) 220px, 45vw" : "(min-width: 640px) 140px, 30vw"}
        className="object-cover"
      />
      {badge}
    </CardPreview>
  );
}

/**
 * The deck laid out as cards, section by section. Each card previews at full
 * size on hover, or on a tap on a phone.
 */
export function DeckGallery({ deck }: { deck: DeckLike }) {
  return (
    <div className="space-y-8">
      {deckSections(deck).map((s) => (
        <section key={s.key}>
          <h3 className="mb-3 flex items-baseline gap-2 font-semibold">
            {s.label}
            <span className="font-mono text-sm font-normal tabular-nums text-fg-faint">
              {cardTotal(s.cards)}
            </span>
          </h3>
          <ul
            className={`grid gap-2.5 ${
              s.key === "battlefields"
                ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-3 sm:grid-cols-5"
            }`}
          >
            {s.cards.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <Tile card={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function WatchGroup({ label, cards }: { label: string; cards: WatchCard[] }) {
  return (
    <section>
      <h4 className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold">
        {label}
        <span className="font-mono text-xs font-normal tabular-nums text-fg-faint">
          {cardTotal(cards)}
        </span>
      </h4>
      {cards.length === 0 ? (
        <p className="text-sm text-fg-faint">None.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {cards.map((c, i) => (
            <li key={`${c.name}-${i}`}>
              <Tile
                card={c}
                tags={
                  <>
                    {c.speed ? (
                      <ArtTag tone={c.speed === "reaction" ? "accent" : "plain"}>
                        {c.speed === "reaction" ? "Reaction" : "Action"}
                      </ArtTag>
                    ) : null}
                    {c.sideboard ? <ArtTag>Side</ArtTag> : null}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What to watch for in a combat, as cards: the tricks (tagged Action or
 * Reaction) and the Hidden cards, with sideboard-only ones marked Side.
 */
export function WatchGallery({ tricks, hidden }: { tricks: WatchCard[]; hidden: WatchCard[] }) {
  return (
    <div className="space-y-5">
      <WatchGroup label="Combat tricks" cards={tricks} />
      <WatchGroup label="Hidden" cards={hidden} />
    </div>
  );
}
