"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { EMPTY_STATE } from "@/app/action-state";
import { registerDeckAction } from "@/app/actions";
import { ActionMessages } from "./action-form";
import { btn, inputClass } from "./ui";

export type PickableDeck = {
  id: string;
  name: string;
  legend: string | null;
  /** The Legend's card image, looked up on the server; null if unknown. */
  art: string | null;
};

/** Past this many decks, a search box appears. */
const SEARCH_FROM = 6;

/**
 * The player's saved decks as a list to tap: the registered one is checked
 * and pinned to the top. One tap registers; tapping it again clears it.
 *
 * Built to stay small however many decks someone saves: the list scrolls
 * inside a fixed height (about five rows), and a search box filters it once
 * there are more than a handful.
 */
export function DeckPicker({
  eventId,
  decks,
  currentId,
}: {
  eventId: string;
  decks: PickableDeck[];
  currentId: string | null;
}) {
  const [state, formAction, pending] = useActionState(registerDeckAction, EMPTY_STATE);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? decks.filter((d) => `${d.name} ${d.legend ?? ""}`.toLowerCase().includes(q))
      : decks;
    // The registered deck first, so it's never scrolled out of sight.
    return [...matching].sort((a, b) => Number(b.id === currentId) - Number(a.id === currentId));
  }, [decks, query, currentId]);

  if (decks.length === 0)
    return (
      <Link href="/decks?new=1" className={btn("default", "md", true)}>
        + Add a deck
      </Link>
    );

  return (
    <div>
      {decks.length > SEARCH_FROM ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${decks.length} decks`}
          aria-label="Search your decks"
          className={`${inputClass} mb-2 h-10 !py-0 text-sm`}
        />
      ) : null}

      <ul
        className={`max-h-[21rem] space-y-2 overflow-y-auto overscroll-contain pr-0.5 ${pending ? "opacity-60" : ""}`}
      >
        {shown.map((d) => {
          const on = d.id === currentId;
          return (
            <li key={d.id}>
              <form action={formAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="deckId" value={on ? "" : d.id} />
                <button
                  type="submit"
                  disabled={pending}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 pr-3.5 text-left transition-colors ${
                    on ? "border-accent/60 bg-accent/10" : "border-hair bg-ink hover:border-fg-faint/50"
                  }`}
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-raised">
                    {d.art ? (
                      <Image
                        src={d.art}
                        alt=""
                        fill
                        sizes="44px"
                        className="scale-[1.6] object-cover object-[50%_24%]"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${on ? "text-accent" : ""}`}>
                      {d.name}
                    </span>
                    {d.legend && d.legend !== d.name ? (
                      <span className="block truncate text-xs text-fg-faint">{d.legend}</span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      on ? "border-accent bg-accent text-ink" : "border-fg-faint/60"
                    }`}
                  >
                    {on ? (
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="py-4 text-center text-sm text-fg-faint">No match.</li> : null}
      </ul>
      <ActionMessages state={state} />
    </div>
  );
}
