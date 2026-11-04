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
}: {
  cards: ReactNode;
  list: ReactNode;
  /** Shown above whichever view is active (Legend, watchlist). */
  header?: ReactNode;
}) {
  const [view, setView] = useState<View>("cards");

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
      <div hidden={view !== "cards"}>{cards}</div>
      <div hidden={view !== "list"}>{list}</div>
    </div>
  );
}
