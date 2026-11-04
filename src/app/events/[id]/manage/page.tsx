import { redirect } from "next/navigation";
import { canRevertElo } from "@/lib/domain/elo";
import { MIN_PLAYERS, activePlayers, currentRound } from "@/lib/domain/event-machine";
import { listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { EventDateControl } from "@/components/event-date";
import { ManagerScorePad } from "@/components/score-select";
import { Avatar, Card, Pill, Section, btn } from "@/components/ui";
import {
  cancelEventAction,
  dropPlayerAction,
  forceCloseRoundAction,
  startEventAction,
  submitScoreAction,
} from "../../../actions";
import { loadEventView } from "../load";

/**
 * The Manage tab, managers only: everything that overrides the normal flow,
 * in one place instead of tucked under the bracket. Disputes come first,
 * since they're the only thing that blocks a round.
 */
export default async function EventManagePage(props: PageProps<"/events/[id]/manage">) {
  const { id } = await props.params;
  const { event, who, nameOf, isManager } = await loadEventView(id);
  if (!isManager || (event.status !== "draft" && event.status !== "running"))
    redirect(`/events/${id}`);

  const cancellable = canRevertElo(await listEventsForLeague(event.leagueId), event.id);
  const round = currentRound(event);
  const open =
    event.status === "running" && round && round.closedAt === null
      ? round.pairings
          .filter((p) => p.b !== null && p.status !== "confirmed")
          // Disputed first: they're what is holding the round up.
          .sort((a, b) => Number(b.status === "disputed") - Number(a.status === "disputed"))
      : [];
  const active = event.players.filter((p) => p.droppedAfterRound === null);

  return (
    <div>
      {event.status === "draft" && activePlayers(event).length >= MIN_PLAYERS ? (
        <ActionForm
          action={startEventAction}
          fields={{ eventId: event.id }}
          label={`Start event · ${event.players.length} ${event.players.length === 1 ? "player" : "players"}`}
          variant="solid"
          size="lg"
          confirm="Close sign-ups and pair round 1"
        />
      ) : null}

      {event.status === "running" && round ? (
        <Section title={`Round ${round.number} results`} count={open.length || undefined}>
          {open.length === 0 ? (
            <Card className="p-4">
              <Pill tone="win">✓ All in</Pill>
            </Card>
          ) : (
            <div className="space-y-3">
              {open.map((p) => (
                <Card key={p.id} tone={p.status === "disputed" ? "loss" : "plain"} className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {nameOf(p.a)} <span className="text-fg-faint">vs</span> {nameOf(p.b)}
                    </span>
                    {p.status === "disputed" ? (
                      <Pill size="sm" tone="loss">
                        Disputed
                      </Pill>
                    ) : p.status === "awaiting_confirmation" ? (
                      <Pill size="sm" tone="draw">
                        Reported
                      </Pill>
                    ) : (
                      <Pill size="sm">Playing</Pill>
                    )}
                  </div>
                  <ManagerScorePad
                    action={submitScoreAction}
                    eventId={event.id}
                    pairingId={p.id}
                    aName={nameOf(p.a)}
                    bName={nameOf(p.b)}
                  />
                </Card>
              ))}
              <div className="flex justify-end">
                <ActionForm
                  action={forceCloseRoundAction}
                  fields={{ eventId: event.id }}
                  label="Force close round"
                  variant="danger"
                  size="sm"
                  confirm="Close with unplayed matches?"
                />
              </div>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Date">
        <Card className="p-4">
          <EventDateControl eventId={event.id} value={event.scheduledFor} />
        </Card>
      </Section>

      {event.status === "running" ? (
        <Section title="Players" count={active.length}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {active.map((p) => {
                const person = who(p.userId);
                return (
                  <li key={p.userId} className="flex items-center gap-3 px-4 py-2">
                    <Avatar name={person.name} image={person.image} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                    <ActionForm
                      action={dropPlayerAction}
                      fields={{ eventId: event.id, targetId: p.userId }}
                      label="Drop"
                      variant="ghost"
                      size="sm"
                      confirm="Drop?"
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      ) : null}

      {/* Same quiet end-of-page placement as "Leave league". */}
      <div className="mt-12 flex justify-center border-t border-hair-soft pt-6">
        {cancellable ? (
          <ActionForm
            action={cancelEventAction}
            fields={{ eventId: event.id }}
            label="Cancel event"
            variant="danger"
            size="sm"
            confirm="Yes, cancel it"
          />
        ) : (
          <span className="flex items-center gap-2">
            <button disabled className={btn("danger", "sm")}>
              Cancel event
            </button>
            <Pill size="sm">Elo locked</Pill>
          </span>
        )}
      </div>
    </div>
  );
}
