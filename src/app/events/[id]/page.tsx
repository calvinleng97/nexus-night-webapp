import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { currentRound, pairingForUser } from "@/lib/domain/event-machine";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { GameScore, NexusEvent, Pairing, User, UserId } from "@/lib/domain/types";
import { getEvent, getLeague, getUsers } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { Bracket } from "@/components/bracket";
import { ManagerScoreSelect, ScoreSelect } from "@/components/score-select";
import { BackLink, Badge, Card, Empty, PageTitle, Score, SectionHead } from "@/components/ui";
import {
  confirmScoreAction,
  disputeScoreAction,
  dropPlayerAction,
  forceCloseRoundAction,
  joinEventAction,
  leaveEventAction,
  startEventAction,
  submitScoreAction,
} from "../../actions";

/** Re-orient a stored (A-perspective) score for a given viewer. */
function fromSideOf(score: GameScore, iAmA: boolean): { mine: number; theirs: number } {
  return iAmA ? { mine: score.a, theirs: score.b } : { mine: score.b, theirs: score.a };
}

function MyMatch({
  event,
  pairing,
  nameOf,
  userId,
}: {
  event: NexusEvent;
  pairing: Pairing;
  nameOf: (id: UserId | null) => string;
  userId: UserId;
}) {
  if (pairing.kind === "bye")
    return (
      <Card tone="accent" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent/80">
          Round {pairing.roundNumber}
        </p>
        <p className="mt-2 text-xl font-semibold">You have the bye</p>
        <p className="mt-1 text-sm text-fg-dim">
          Counted as a win. Your next opponent appears once the round finishes.
        </p>
      </Card>
    );

  const iAmA = pairing.a === userId;
  const opponent = iAmA ? pairing.b : pairing.a;
  const common = { eventId: event.id, pairingId: pairing.id };
  const report = pairing.report;

  return (
    <Card tone="accent" className="p-5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent/80">
          Round {pairing.roundNumber}
        </p>
        {pairing.rematch ? <Badge tone="draw">rematch</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-fg-dim">You play</p>
      <p className="text-2xl font-semibold leading-tight tracking-tight">{nameOf(opponent)}</p>

      {pairing.status === "pending" ? (
        <div className="mt-5">
          <ActionForm action={submitScoreAction} fields={common} label="Submit" variant="primary">
            <ScoreSelect />
          </ActionForm>
        </div>
      ) : null}

      {pairing.status === "awaiting_confirmation" && report ? (
        report.submittedBy === userId ? (
          <p className="mt-5 text-sm text-fg-dim">
            You reported{" "}
            <span className="font-mono tabular-nums text-fg">
              {fromSideOf(report.score, iAmA).mine}–{fromSideOf(report.score, iAmA).theirs}
            </span>
            . Waiting on {nameOf(opponent)}.
          </p>
        ) : (
          <div className="mt-5">
            <p className="text-sm">
              {nameOf(opponent)} says you went{" "}
              <span className="font-mono tabular-nums">
                {fromSideOf(report.score, iAmA).mine}–{fromSideOf(report.score, iAmA).theirs}
              </span>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionForm
                action={confirmScoreAction}
                fields={common}
                label="Confirm"
                variant="primary"
                compact
              />
              <ActionForm
                action={disputeScoreAction}
                fields={common}
                label="That's wrong"
                variant="danger"
                compact
              />
            </div>
          </div>
        )
      ) : null}

      {pairing.status === "disputed" ? (
        <p className="mt-5 text-sm text-loss">Disputed — a manager will settle it.</p>
      ) : null}

      {pairing.status === "confirmed" && report ? (
        <p className="mt-5 text-sm text-fg-dim">
          Final <Score {...fromSideOf(report.score, iAmA)} /> — waiting on the rest of the round.
        </p>
      ) : null}
    </Card>
  );
}

export default async function EventPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();
  const [league, users] = await Promise.all([
    getLeague(event.leagueId),
    getUsers([...event.players.map((p) => p.userId), ...event.managerIds]),
  ]);

  const nameOf = (uid: UserId | null) =>
    uid ? ((users as Map<UserId, User>).get(uid)?.name ?? "Unknown") : "—";
  const standings = computeStandings(event);
  const round = currentRound(event);
  const isManager = event.managerIds.includes(userId);
  const isPlayer = event.players.some((p) => p.userId === userId);
  const myPairing = round ? pairingForUser(round, userId) : null;
  const open = round?.pairings.filter((p) => p.status !== "confirmed") ?? [];

  return (
    <div>
      <BackLink href={league ? `/leagues/${league.id}` : "/leagues"}>
        {league?.name ?? "Leagues"}
      </BackLink>
      <div className="mt-3">
        <PageTitle>{event.name}</PageTitle>
      </div>

      {/* --------------------------------------------------------- draft */}
      {event.status === "draft" ? (
        <>
          <Card className="mb-7 p-5">
            <p className="text-sm text-fg-dim">
              {event.players.length} player{event.players.length === 1 ? "" : "s"} signed up ·{" "}
              {event.totalRounds} rounds
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {isPlayer ? (
                <ActionForm
                  action={leaveEventAction}
                  fields={{ eventId: event.id }}
                  label="Leave"
                  variant="ghost"
                  compact
                />
              ) : (
                <ActionForm
                  action={joinEventAction}
                  fields={{ eventId: event.id }}
                  label="Join event"
                  variant="primary"
                  compact
                />
              )}
              {isManager ? (
                <ActionForm
                  action={startEventAction}
                  fields={{ eventId: event.id }}
                  label="Start event"
                  variant="primary"
                  confirm="Start and pair round 1?"
                  compact
                />
              ) : null}
            </div>
          </Card>

          <SectionHead count={event.players.length}>Signed up</SectionHead>
          {event.players.length === 0 ? (
            <Empty>Nobody yet.</Empty>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {event.players.map((p) => (
                <li
                  key={p.userId}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    p.userId === userId
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-hair-soft bg-raised text-fg-dim"
                  }`}
                >
                  {nameOf(p.userId)}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {/* ------------------------------------------------------- running */}
      {event.status === "running" && round ? (
        <div className="mb-8 space-y-3">
          {myPairing ? (
            <MyMatch event={event} pairing={myPairing} nameOf={nameOf} userId={userId} />
          ) : (
            <Card className="p-4">
              <p className="text-sm text-fg-faint">
                {isPlayer
                  ? "You were dropped from this event."
                  : "You're spectating — you didn't join this event."}
              </p>
            </Card>
          )}
          <p className="px-1 text-sm text-fg-faint">
            {open.length === 0
              ? "All results in — the next round is being paired."
              : `${open.length} match${open.length === 1 ? "" : "es"} still to report.`}
          </p>
        </div>
      ) : null}

      {/* ----------------------------------------------------- standings */}
      {event.status !== "draft" ? (
        <div className="mb-9">
          <SectionHead>Standings</SectionHead>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-fg-faint">
                  <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
                  <th className="py-2.5 pr-2 font-medium">Player</th>
                  <th className="py-2.5 pr-2 text-right font-medium">Pts</th>
                  <th className="py-2.5 pr-4 text-right font-medium">W–L</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr
                    key={s.userId}
                    className={`border-b border-hair-soft last:border-0 ${
                      s.userId === userId ? "bg-accent/5" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-4 pr-2 text-fg-faint">{s.rank}</td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={`${s.dropped ? "text-fg-faint line-through" : ""} ${
                          s.userId === userId ? "text-accent" : ""
                        }`}
                      >
                        {nameOf(s.userId)}
                      </span>
                      {s.byes > 0 ? (
                        <span className="ml-1.5 text-xs text-fg-faint">bye</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums">
                      {s.matchPoints}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-fg-dim">
                      {recordLabel(s)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}

      {/* -------------------------------------------------------- bracket */}
      {event.rounds.length > 0 ? (
        <div className="mb-9">
          <SectionHead>Bracket</SectionHead>
          <Bracket rounds={event.rounds} nameOf={nameOf} viewerId={userId} />
        </div>
      ) : null}

      {/* -------------------------------------------------- manager tools */}
      {isManager && event.status !== "draft" ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-fg-faint transition-colors hover:text-fg">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
            Manager tools
          </summary>
          <div className="mt-4 space-y-5">
            {round && round.closedAt === null && open.length > 0 ? (
              <div className="space-y-3">
                {open.map((p) => (
                  <Card key={p.id} tone="raised" className="p-3">
                    <p className="mb-2 text-sm">
                      {nameOf(p.a)} <span className="text-fg-faint">vs</span> {nameOf(p.b)}
                      {p.status === "disputed" ? (
                        <span className="ml-2 text-loss">disputed</span>
                      ) : null}
                    </p>
                    <ActionForm
                      action={submitScoreAction}
                      fields={{ eventId: event.id, pairingId: p.id }}
                      label="Set result"
                      compact
                    >
                      <ManagerScoreSelect aName={nameOf(p.a)} bName={nameOf(p.b)} />
                    </ActionForm>
                  </Card>
                ))}
                <ActionForm
                  action={forceCloseRoundAction}
                  fields={{ eventId: event.id }}
                  label="Force close round"
                  variant="danger"
                  confirm="Close with unplayed matches?"
                  compact
                />
              </div>
            ) : null}

            <div>
              <SectionHead>Drop a player</SectionHead>
              <ul className="divide-y divide-hair-soft">
                {event.players
                  .filter((p) => p.droppedAfterRound === null)
                  .map((p) => (
                    <li key={p.userId} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{nameOf(p.userId)}</span>
                      <ActionForm
                        action={dropPlayerAction}
                        fields={{ eventId: event.id, targetId: p.userId }}
                        label="Drop"
                        variant="ghost"
                        confirm="Confirm drop"
                        compact
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
