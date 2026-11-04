import Link from "next/link";
import { MIN_PLAYERS, activePlayers, currentRound } from "@/lib/domain/event-machine";
import { disputedCount, myMatch, roundProgress, type MyMatch, type Seen } from "@/lib/domain/my-match";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { NexusEvent, UserId } from "@/lib/domain/types";
import { listDecksForUser } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { DeckPicker } from "@/components/deck-picker";
import { MatchList, MatchRow, StandingsTable, type WhoFn } from "@/components/event-bits";
import { ScorePad } from "@/components/score-select";
import { Avatar, Card, Empty, LinkButton, Pill, Section, Stat } from "@/components/ui";
import {
  confirmScoreAction,
  disputeScoreAction,
  joinEventAction,
  leaveEventAction,
  startEventAction,
  submitScoreAction,
} from "../../actions";
import { loadEventView } from "./load";

/**
 * The event's front page, and the one that changes most with its state:
 * sign-ups while it's open, your match while it's live, results once it's
 * done. Whatever you need to do next is at the top.
 */
export default async function EventOverviewPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const view = await loadEventView(id);
  const { event } = view;

  if (event.status === "draft") return <SignUps {...view} />;
  if (event.status === "running") return <Live {...view} />;
  return <Results {...view} />;
}

type View = Awaited<ReturnType<typeof loadEventView>>;

// ------------------------------------------------------------------ sign-ups

async function SignUps({ userId, event, who, legendOf, myPlayer, isPlayer, isManager }: View) {
  const decks = isPlayer ? await listDecksForUser(userId) : [];

  return (
    <div>
      {isPlayer ? (
        <Card tone="win" className="p-5">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-lg font-semibold text-win">✓ You&apos;re in</p>
            <ActionForm
              action={leaveEventAction}
              fields={{ eventId: event.id }}
              label="Leave"
              variant="ghost"
              size="sm"
              confirm="Leave?"
            />
          </div>
          <div className="mt-5 border-t border-win/15 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="min-w-0 flex-1 font-semibold">Your deck</h2>
              {myPlayer?.deck ? (
                <Pill tone="accent">✓ Registered</Pill>
              ) : (
                <Pill tone="draw">None yet</Pill>
              )}
            </div>
            <DeckPicker
              eventId={event.id}
              decks={decks.map((d) => ({ id: d.id, name: d.name, legend: d.legend }))}
              currentId={myPlayer?.deck?.deckId ?? null}
            />
          </div>
        </Card>
      ) : (
        <ActionForm
          action={joinEventAction}
          fields={{ eventId: event.id }}
          label="Join this event"
          variant="solid"
          size="lg"
        />
      )}

      {isManager && activePlayers(event).length >= MIN_PLAYERS ? (
        <ActionForm
          action={startEventAction}
          fields={{ eventId: event.id }}
          label={`Start event · ${event.players.length} ${event.players.length === 1 ? "player" : "players"}`}
          variant="primary"
          size="lg"
          confirm="Close sign-ups and pair round 1"
          className="mt-4"
        />
      ) : null}

      <Section title="Going" count={event.players.length}>
        {event.players.length === 0 ? (
          <Empty>Nobody yet.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {event.players.map((p) => {
                const person = who(p.userId);
                const me = p.userId === userId;
                return (
                  <li
                    key={p.userId}
                    className={`flex items-center gap-3 px-4 py-2.5 ${me ? "bg-accent/[0.06]" : ""}`}
                  >
                    <Avatar name={person.name} image={person.image} />
                    <span className={`min-w-0 flex-1 truncate ${me ? "font-semibold text-accent" : ""}`}>
                      {person.name}
                    </span>
                    {legendOf(p.userId) ? (
                      <span className="max-w-[45%] truncate text-sm text-fg-dim">
                        {legendOf(p.userId)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------- live

function Verdict({ score, className = "" }: { score: Seen; className?: string }) {
  const { mine, theirs } = score;
  const [word, tone] =
    mine > theirs ? ["Won", "text-win"] : mine < theirs ? ["Lost", "text-loss"] : ["Drew", "text-draw"];
  return (
    <p className={`text-3xl font-bold tracking-tight ${className}`}>
      <span className={tone}>{word}</span>{" "}
      <span className="font-mono tabular-nums">
        {mine}–{theirs}
      </span>
    </p>
  );
}

function MatchHero({ event, m, who }: { event: NexusEvent; m: MyMatch; who: WhoFn }) {
  const common = { eventId: event.id, pairingId: m.pairing.id };
  const round = (
    <div className="flex items-center gap-2">
      <p className="text-sm font-semibold text-accent">Round {m.pairing.roundNumber}</p>
      {m.pairing.rematch ? <Pill size="sm" tone="draw">Rematch</Pill> : null}
    </div>
  );

  if (m.kind === "bye")
    return (
      <Card tone="accent" className="p-5">
        {round}
        <p className="mt-3 text-3xl font-bold tracking-tight">Bye</p>
        <div className="mt-3">
          <Pill tone="win">Free win</Pill>
        </div>
      </Card>
    );

  const opp = who(m.opponent);
  const body = (() => {
    switch (m.kind) {
      case "report":
        return <ScorePad action={submitScoreAction} eventId={event.id} pairingId={m.pairing.id} />;
      case "confirm":
        return (
          <>
            <div className="rounded-xl border border-draw/25 bg-draw/[0.06] p-4">
              <p className="text-sm font-medium text-draw">{opp.name} reported</p>
              <Verdict score={m.score} className="mt-1" />
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <ActionForm action={confirmScoreAction} fields={common} label="Confirm" variant="solid" size="lg" />
              <ActionForm action={disputeScoreAction} fields={common} label="Dispute" variant="danger" size="lg" />
            </div>
          </>
        );
      case "waiting":
        return (
          <>
            <Verdict score={m.score} />
            <div className="mt-3">
              <Pill pulse>Waiting on {opp.name}</Pill>
            </div>
          </>
        );
      case "disputed":
        return <Pill tone="loss">Disputed</Pill>;
      case "done":
        return (
          <>
            {m.score ? <Verdict score={m.score} /> : null}
            <div className="mt-3">
              <Pill tone="win">✓ Confirmed</Pill>
            </div>
          </>
        );
    }
  })();

  return (
    <Card tone="accent" className="p-5">
      {round}
      <div className="mt-4 flex items-center gap-3.5">
        <Avatar name={opp.name} image={opp.image} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-fg-dim">vs</p>
          <p className="truncate text-2xl font-bold leading-tight tracking-tight">{opp.name}</p>
        </div>
      </div>
      <div className="mt-6">{body}</div>
    </Card>
  );
}

/** One segment per match, filled as results are confirmed. */
function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1" aria-label={`${done} of ${total} matches in`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-win" : "bg-hair"}`} />
      ))}
    </div>
  );
}

async function Live({ userId, event, who, legendOf, myPlayer, isPlayer, isManager }: View) {
  const round = currentRound(event);
  const m = myMatch(event, userId);
  const standings = computeStandings(event);
  const progress = round ? roundProgress(round) : { done: 0, total: 0 };
  const disputes = isManager ? disputedCount(event) : 0;
  const dropped = myPlayer?.droppedAfterRound != null;
  const decks = isPlayer && !dropped ? await listDecksForUser(userId) : [];

  return (
    <div>
      {disputes > 0 ? (
        <Card tone="loss" className="mb-4 flex items-center gap-3 p-4">
          <Pill tone="loss" dot>
            {disputes} disputed
          </Pill>
          <span className="flex-1" />
          <LinkButton href={`/events/${event.id}/manage`} variant="danger" size="sm">
            Resolve →
          </LinkButton>
        </Card>
      ) : null}

      {m ? (
        <MatchHero event={event} m={m} who={who} />
      ) : (
        <div className="flex">
          <Pill>{dropped ? "Dropped" : "Spectating"}</Pill>
        </div>
      )}

      {round ? (
        <Section
          title={`Round ${round.number} of ${event.totalRounds}`}
          action={
            <span className="font-mono text-sm tabular-nums text-fg-dim">
              {progress.done}/{progress.total}
            </span>
          }
        >
          <div className="mb-3">
            <ProgressBar {...progress} />
          </div>
          <MatchList>
            {round.pairings.map((p) => (
              <MatchRow key={p.id} pairing={p} who={who} legendOf={legendOf} viewerId={userId} />
            ))}
          </MatchList>
        </Section>
      ) : null}

      <Section title="Standings">
        <StandingsTable standings={standings} who={who} legendOf={legendOf} viewerId={userId} />
      </Section>

      {isPlayer && !dropped ? (
        <details className="group mt-10">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-hair-soft bg-surface px-4 py-3 transition-colors hover:bg-raised">
            <span className="font-semibold">Your deck</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm text-fg-dim">
              {myPlayer?.deck?.name ?? "None"}
            </span>
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-fg-faint transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </summary>
          <div className="mt-3">
            <DeckPicker
              eventId={event.id}
              decks={decks.map((d) => ({ id: d.id, name: d.name, legend: d.legend }))}
              currentId={myPlayer?.deck?.deckId ?? null}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------- results

function Results({ userId, event, who, legendOf }: View) {
  const standings = computeStandings(event);
  const me = standings.find((s) => s.userId === userId);
  const tied = me ? standings.filter((s) => s.rank === me.rank).length > 1 : false;

  return (
    <div>
      {me ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Finish"
            value={`${tied ? "T-" : ""}${me.rank}/${standings.length}`}
            tone={me.rank === 1 ? "accent" : undefined}
          />
          <Stat label="Record" value={recordLabel(me)} />
          <Stat label="Games" value={`${me.gamesWon}–${me.gamesLost}`} />
        </div>
      ) : null}

      <Section
        title="Final standings"
        action={
          <Link href={`/events/${event.id}/bracket`} className="text-sm text-fg-dim hover:text-fg">
            All rounds →
          </Link>
        }
      >
        <StandingsTable standings={standings} who={who} legendOf={legendOf} viewerId={userId as UserId} />
      </Section>
    </div>
  );
}
