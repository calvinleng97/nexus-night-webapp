"use client";

import { useEffect, useState, type ReactNode } from "react";

type View = "cards" | "list";
const KEY = "nn.deckView";
/** Lets every decklist on the page follow a switch made in any one of them. */
const EVENT = "nn:deck-view";

function stored(): View | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "cards" || v === "list" ? v : null;
  } catch {
    return null; // private mode, blocked storage
  }
}

/**
 * Cards or List for a decklist. Both are rendered on the server; this only
 * picks which one shows. The hidden one stays `hidden`, so its card images are
 * never downloaded. The choice is remembered on this device and applied to
 * every decklist on the page.
 */
export function DeckViewSwitch({
  cards,
  list,
  header,
  watchLabel,
  watchCards,
  watchList,
}: {
  cards: ReactNode;
  list: ReactNode;
  /** Shown above whichever view is active (the Legend). */
  header?: ReactNode;
  /** "10 combat tricks · 8 Hidden", or null when the deck has neither. */
  watchLabel?: string | null;
  /** The watchlist in each view: art for Cards, text for List. */
  watchCards?: ReactNode;
  watchList?: ReactNode;
}) {
  const [view, setView] = useState<View>("cards");
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    const initial = stored();
    if (initial) setView(initial);
    const onChange = (e: Event) => setView((e as CustomEvent<View>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const choose = (v: View) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // Still switch this page even if it can't be remembered.
    }
    window.dispatchEvent(new CustomEvent<View>(EVENT, { detail: v }));
  };

  const tab = (v: View, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => choose(v)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        view === v ? "bg-raised text-fg shadow-sm shadow-black/40" : "text-fg-faint hover:text-fg-dim"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <div role="tablist" aria-label="Decklist view" className="flex shrink-0 gap-0.5 rounded-lg border border-hair-soft bg-surface p-0.5">
          {tab("cards", "Cards")}
          {tab("list", "List")}
        </div>
      </div>
      {watchLabel ? (
        <div className="mb-5">
          <button
            type="button"
            aria-expanded={watching}
            onClick={() => setWatching((w) => !w)}
            className={`group inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
              watching ? "text-accent" : "text-fg-dim hover:text-fg"
            }`}
          >
            {watchLabel}
            <svg aria-hidden viewBox="0 0 16 16" className={`size-3.5 transition-transform ${watching ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {/* Hidden until asked for, so its art isn't fetched before then. */}
          <div hidden={!watching} className="mt-3 rounded-xl border border-accent/20 bg-accent-soft/10 p-3">
            <div hidden={view !== "cards"}>{watchCards}</div>
            <div hidden={view !== "list"}>{watchList}</div>
          </div>
        </div>
      ) : null}
      <div hidden={view !== "cards"}>{cards}</div>
      <div hidden={view !== "list"}>{list}</div>
    </div>
  );
}
