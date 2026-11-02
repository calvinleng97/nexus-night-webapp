import Link from "next/link";
import { registerDeckAction } from "@/app/actions";
import type { Deck, RegisteredDeck } from "@/lib/domain/types";
import { ActionForm } from "./action-form";
import { Card, MicroLabel } from "./ui";

/**
 * Lets a player attach one of their saved decks to this event.
 *
 * `bare` drops the card and label, for when a surrounding card already says
 * what this is.
 */
export function DeckPicker({
  eventId,
  decks,
  current,
  bare = false,
}: {
  eventId: string;
  decks: Deck[];
  current: RegisteredDeck | null;
  bare?: boolean;
}) {
  const body =
    decks.length === 0 ? (
      <p className="text-sm text-fg-dim">
        You have no saved decks.{" "}
        <Link href="/decks" className="text-accent underline underline-offset-2">
          Add one
        </Link>{" "}
        to register it here. Registering is optional.
      </p>
    ) : (
      <ActionForm action={registerDeckAction} fields={{ eventId }} label="Save" variant="primary" compact>
        <select
          name="deckId"
          defaultValue={current?.deckId ?? ""}
          className="mb-2 w-full rounded-xl border border-hair bg-ink px-3 py-2 text-sm text-fg outline-none focus:border-accent/50"
        >
          <option value="">No deck registered</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {/* A deck named after its Legend should not say it twice. */}
              {d.legend && d.legend !== d.name ? `${d.name} — ${d.legend}` : d.name}
            </option>
          ))}
        </select>
      </ActionForm>
    );

  if (bare) return body;
  return (
    <Card className="p-4">
      <MicroLabel>Your deck</MicroLabel>
      <div className="mt-3">{body}</div>
    </Card>
  );
}
