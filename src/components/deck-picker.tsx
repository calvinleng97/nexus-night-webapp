"use client";

import Link from "next/link";
import { useActionState } from "react";
import { EMPTY_STATE } from "@/app/action-state";
import { registerDeckAction } from "@/app/actions";
import { ActionMessages } from "./action-form";
import { btn } from "./ui";

export type PickableDeck = { id: string; name: string; legend: string | null };

/**
 * The player's saved decks as a list to tap: the registered one is checked.
 * One tap registers; tapping the registered one again clears it.
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

  if (decks.length === 0)
    return (
      <Link href="/decks?new=1" className={btn("default", "md", true)}>
        + Add a deck
      </Link>
    );

  return (
    <div>
      <ul className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
        {decks.map((d) => {
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
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    on
                      ? "border-accent/60 bg-accent/10"
                      : "border-hair bg-ink hover:border-fg-faint/50"
                  }`}
                >
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
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${on ? "text-accent" : ""}`}>
                      {d.name}
                    </span>
                    {d.legend && d.legend !== d.name ? (
                      <span className="block truncate text-xs text-fg-faint">{d.legend}</span>
                    ) : null}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <ActionMessages state={state} />
    </div>
  );
}
