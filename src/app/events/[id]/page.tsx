import { canRevertElo } from "@/lib/domain/elo";
import { listDecksForUser, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { DeckPicker } from "@/components/deck-picker";
import { EventDateControl } from "@/components/event-date";
import { Card, MicroLabel, Tag } from "@/components/ui";
import {
  cancelEventAction,
  joinEventAction,
  leaveEventAction,
  startEventAction,
} from "../../actions";
import { loadEventView } from "./load";

/**
 * The Registration tab: whether you're in, your deck, and — for managers —
 * starting the event and its date. One card per thing you can do.
 */
export default async function EventRegistrationPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const { userId, event, myPlayer, isPlayer, isManager } = await loadEventView(id);
  const myDecks = await listDecksForUser(userId);
  const open = event.status === "draft";
  const live = open || event.status === "running";
  const cancellable =
    isManager && live && canRevertElo(await listEventsForLeague(event.leagueId), event.id);
  const dropped = myPlayer?.droppedAfterRound != null;

  return (
    <div className="space-y-3">
      {/* Am I in? Once joined, the join control becomes a green card. */}
      {isPlayer && !dropped ? (
        <Card tone="win" className="flex items-center gap-3 p-4 pl-5">
          <p className="min-w-0 flex-1 font-semibold text-win">✓ You&apos;re in</p>
          {open ? (
            <ActionForm
              action={leaveEventAction}
              fields={{ eventId: event.id }}
              label="Leave"
              variant="danger"
              compact
            />
          ) : null}
        </Card>
      ) : open ? (
        <ActionForm
          action={joinEventAction}
          fields={{ eventId: event.id }}
          label="Join this event"
          variant="solid"
          size="lg"
        />
      ) : (
        <Card className="flex items-center gap-3 p-4 pl-5">
          <p className="min-w-0 flex-1 font-semibold text-fg-dim">
            {dropped ? "Dropped" : "Registration closed"}
          </p>
        </Card>
      )}

      {/* Decks can change until the event is over. */}
      {isPlayer && live ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="min-w-0 flex-1 font-semibold">Your deck</h2>
            {myPlayer?.deck ? <Tag tone="accent">✓ Registered</Tag> : null}
          </div>
          <DeckPicker eventId={event.id} decks={myDecks} current={myPlayer?.deck ?? null} bare />
        </Card>
      ) : null}

      {isManager && live ? (
        <Card tone="raised" className="space-y-5 p-5">
          <MicroLabel>Manager</MicroLabel>
          {open ? (
            <ActionForm
              action={startEventAction}
              fields={{ eventId: event.id }}
              label="Start event →"
              variant="primary"
              size="lg"
              confirm="Pair round 1 now? Sign-ups will close."
            />
          ) : null}
          <div className={open ? "border-t border-hair-soft pt-5" : ""}>
            <EventDateControl eventId={event.id} value={event.scheduledFor} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-hair-soft pt-5">
            {cancellable ? (
              <ActionForm
                action={cancelEventAction}
                fields={{ eventId: event.id }}
                label="Cancel event"
                variant="danger"
                confirm="Cancel this event?"
                compact
              />
            ) : (
              <Tag>Elo locked</Tag>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
