import type { NexusEvent, UserId } from "@/lib/domain/types";
import { DeckDisclosure } from "@/components/deck-view";
import { Card, CountPill, Empty, SectionHead, Tag } from "@/components/ui";
import { loadEventView } from "../load";

/**
 * Everyone's registered list for this event, visible to all from the moment
 * it's registered — these are friendly nights, so looking around is welcome.
 */
function DeckRoster({
  event,
  nameOf,
  viewerId,
}: {
  event: NexusEvent;
  nameOf: (id: UserId | null) => string;
  viewerId: UserId;
}) {
  const registered = event.players.filter((p) => p.deck !== null);
  const missing = event.players.length - registered.length;

  return (
    <div>
      <SectionHead
        count={registered.length}
        action={missing > 0 ? <CountPill value={missing} label="no deck" tone="warn" /> : null}
      >
        Decks
      </SectionHead>
      {registered.length === 0 ? (
        <Empty>Nobody has registered a deck.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {registered.map((p) => {
            const deck = p.deck!;
            return (
              <Card as="li" key={p.userId} className="p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className={`font-medium ${p.userId === viewerId ? "text-accent" : ""}`}>
                    {nameOf(p.userId)}
                  </p>
                  {deck.legend ? <p className="text-sm text-accent">{deck.legend}</p> : null}
                  {deck.name !== deck.legend ? (
                    <p className="text-sm text-fg-dim">{deck.name}</p>
                  ) : null}
                </div>
                <div className="mt-3">
                  <DeckDisclosure deck={deck} />
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The Players tab: who is signed up, and what they're playing. */
export default async function EventPlayersPage(props: PageProps<"/events/[id]/players">) {
  const { id } = await props.params;
  const { userId, event, nameOf } = await loadEventView(id);

  return (
    <div className="space-y-9">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Signed up</h2>
          <div className="flex-1" />
          {event.players.length === 0 ? (
            <Tag tone="warn">Needs players</Tag>
          ) : (
            <CountPill
              value={event.players.length}
              label={event.players.length === 1 ? "player" : "players"}
              tone="accent"
            />
          )}
        </div>
        {event.players.length === 0 ? (
          <Empty>Nobody yet.</Empty>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {event.players.map((p) => (
              <li
                key={p.userId}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  p.userId === userId
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-hair-soft bg-raised text-fg-dim"
                } ${p.droppedAfterRound !== null ? "line-through opacity-60" : ""}`}
              >
                {nameOf(p.userId)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {event.players.length > 0 ? (
        <DeckRoster event={event} nameOf={nameOf} viewerId={userId} />
      ) : null}
    </div>
  );
}
