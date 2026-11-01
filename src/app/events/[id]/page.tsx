import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { currentRound, pairingForUser } from "@/lib/domain/event-machine";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { GameScore, NexusEvent, Pairing, User, UserId } from "@/lib/domain/types";
import { getEvent, getLeague, getUsers } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { ManagerScoreSelect, ScoreSelect } from "@/components/score-select";
import { Badge, Empty, Panel, PageTitle } from "@/components/ui";
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

function name(users: Map<UserId, User>, id: UserId | null): string {
  if (!id) return "—";
  return users.get(id)?.name ?? "Unknown player";
}

function MyMatch({
  event,
  pairing,
  users,
  userId,
}: {
  event: NexusEvent;
  pairing: Pairing;
  users: Map<UserId, User>;
  userId: UserId;
}) {
  if (pairing.kind === "bye") {
    return (
      <Panel className="border-accent-dim/50 bg-accent/5">
        <Badge tone="accent">Round {pairing.roundNumber}</Badge>
        <p className="mt-2 text-lg font-medium">You have the bye this round.</p>
        <p className="mt-1 text-sm text-muted">
          Counted as a win. Sit this one out — the next round appears once everyone else reports.
        </p>
      </Panel>
    );
  }

  const iAmA = pairing.a === userId;
  const opponent = iAmA ? pairing.b : pairing.a;
  const common = { eventId: event.id, pairingId: pairing.id };

  return (
    <Panel className="border-accent-dim/50 bg-accent/5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Round {pairing.roundNumber}</Badge>
        {pairing.rematch ? <Badge tone="draw">Rematch</Badge> : null}
        {pairing.kind === "forfeit" ? <Badge tone="loss">Forfeit</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">Your opponent</p>
      <p className="text-2xl font-semibold tracking-tight">{name(users, opponent)}</p>

      {pairing.status === "pending" ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">Report the best-of-three when you&apos;re done.</p>
          <ActionForm action={submitScoreAction} fields={common} label="Submit result" variant="primary">
            <ScoreSelect />
          </ActionForm>
        </div>
      ) : null}

      {pairing.status === "awaiting_confirmation" && pairing.report ? (
        pairing.report.submittedBy === userId ? (
          (() => {
            const s = fromSideOf(pairing.report.score, iAmA);
            return (
              <p className="mt-4 text-sm">
                You reported{" "}
                <strong>
                  {s.mine}-{s.theirs}
                </strong>
                . Waiting on {name(users, opponent)} to confirm.
              </p>
            );
          })()
        ) : (
          (() => {
            const s = fromSideOf(pairing.report.score, iAmA);
            return (
              <div className="mt-4 space-y-3">
                <p className="text-sm">
                  {name(users, opponent)} reported that you went{" "}
                  <strong>
                    {s.mine}-{s.theirs}
                  </strong>
                  . Is that right?
                </p>
                <div className="flex flex-wrap gap-2">
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
            );
          })()
        )
      ) : null}

      {pairing.status === "disputed" ? (
        <p className="mt-4 text-sm text-loss">
          This result is disputed. An event manager needs to settle it before the round can close.
        </p>
      ) : null}

      {pairing.status === "confirmed" && pairing.report ? (
        (() => {
          const s = fromSideOf(pairing.report.score, iAmA);
          const verdict = s.mine > s.theirs ? "Win" : s.mine < s.theirs ? "Loss" : "Draw";
          return (
            <p className="mt-4 text-sm">
              Final: <strong>{verdict}</strong> {s.mine}-{s.theirs}. Waiting on the rest of the
              round.
            </p>
          );
        })()
      ) : null}
    </Panel>
  );
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();
  const league = await getLeague(event.leagueId);

  const users = await getUsers([
    ...event.players.map((p) => p.userId),
    ...event.managerIds,
  ]);
  const standings = computeStandings(event);
  const round = currentRound(event);
  const isManager = event.managerIds.includes(userId);
  const isPlayer = event.players.some((p) => p.userId === userId);
  const myPairing = round ? pairingForUser(round, userId) : null;
  const openCount = round?.pairings.filter((p) => p.status !== "confirmed").length ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        sub={
          league ? (
            <>
              <Link href={`/leagues/${league.id}`} className="underline hover:text-white">
                {league.name}
              </Link>
              {" · "}
              {event.status === "draft"
                ? `${event.totalRounds} rounds planned`
                : `round ${round?.number ?? 0} of ${event.totalRounds}`}
            </>
          ) : undefined
        }
      >
        {event.name}
      </PageTitle>

      {/* -------------------------------------------------- draft */}
      {event.status === "draft" ? (
        <>
          <Panel>
            <h2 className="font-medium">
              {event.players.length} player{event.players.length === 1 ? "" : "s"} signed up
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pairings are generated when a manager starts the event.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {isPlayer ? (
                <ActionForm
                  action={leaveEventAction}
                  fields={{ eventId: event.id }}
                  label="Leave event"
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
          </Panel>
          <Panel>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Signed up
            </h3>
            {event.players.length === 0 ? (
              <Empty>Nobody yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {event.players.map((p) => (
                  <li key={p.userId} className="py-2 first:pt-0 last:pb-0">
                    {name(users, p.userId)}
                    {p.userId === userId ? <span className="text-muted"> (you)</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}

      {/* ------------------------------------------------ running */}
      {event.status === "running" && round ? (
        <>
          {myPairing ? (
            <MyMatch event={event} pairing={myPairing} users={users} userId={userId} />
          ) : isPlayer ? (
            <Panel>
              <p className="text-sm text-muted">
                You were dropped from this event, so you have no match this round.
              </p>
            </Panel>
          ) : (
            <Panel>
              <p className="text-sm text-muted">You&apos;re spectating — you didn&apos;t join this event.</p>
            </Panel>
          )}

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Round {round.number}</h2>
              <span className="text-sm text-muted">
                {openCount === 0 ? "all reported" : `${openCount} outstanding`}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {round.pairings.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">
                    {p.b === null ? (
                      <>
                        {name(users, p.a)} <span className="text-muted">— bye</span>
                      </>
                    ) : (
                      <>
                        {name(users, p.a)} <span className="text-muted">vs</span> {name(users, p.b)}
                      </>
                    )}
                  </span>
                  {p.rematch ? <Badge tone="draw">rematch</Badge> : null}
                  {p.status === "confirmed" && p.report ? (
                    <Badge tone="win">
                      {p.report.score.a}-{p.report.score.b}
                    </Badge>
                  ) : p.status === "confirmed" ? (
                    <Badge tone="win">bye</Badge>
                  ) : p.status === "disputed" ? (
                    <Badge tone="loss">disputed</Badge>
                  ) : p.status === "awaiting_confirmation" ? (
                    <Badge tone="draw">awaiting confirm</Badge>
                  ) : (
                    <Badge>pending</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}

      {/* ----------------------------------------------- standings */}
      {event.status !== "draft" ? (
        <Panel>
          <h2 className="mb-1 font-medium">Standings</h2>
          <p className="mb-3 text-xs text-muted">
            Records only — equal records share a rank and no winner is crowned. Every game score is
            saved, so tiebreakers stay computable later.
          </p>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Player</th>
                  <th className="py-2 pr-2 text-right font-medium">Pts</th>
                  <th className="py-2 pr-2 text-right font-medium">Record</th>
                  <th className="py-2 text-right font-medium">Games</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr key={s.userId} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-2 text-muted">{s.rank}</td>
                    <td className="py-2 pr-2">
                      <span className={s.dropped ? "text-muted line-through" : ""}>
                        {name(users, s.userId)}
                      </span>
                      {s.userId === userId ? <span className="text-muted"> (you)</span> : null}
                      {s.byes > 0 ? <span className="ml-1 text-xs text-muted">·bye</span> : null}
                    </td>
                    <td className="py-2 pr-2 text-right font-medium">{s.matchPoints}</td>
                    <td className="py-2 pr-2 text-right">{recordLabel(s)}</td>
                    <td className="py-2 text-right text-muted">
                      {s.gamesWon}-{s.gamesLost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {/* ------------------------------------------------- history */}
      {event.rounds.length > 1 || event.status === "complete" ? (
        <Panel>
          <h2 className="mb-3 font-medium">All rounds</h2>
          <div className="space-y-4">
            {event.rounds.map((r) => (
              <div key={r.number}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Round {r.number}
                  {r.closedAt ? "" : " (open)"}
                </h3>
                <ul className="mt-1 divide-y divide-line/60 text-sm">
                  {r.pairings.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        {p.b === null
                          ? `${name(users, p.a)} — bye`
                          : `${name(users, p.a)} vs ${name(users, p.b)}`}
                      </span>
                      <span className="text-muted">
                        {p.report ? `${p.report.score.a}-${p.report.score.b}` : p.b === null ? "win" : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* ------------------------------------------ manager tools */}
      {isManager && event.status !== "draft" ? (
        <Panel className="border-accent-dim/40">
          <h2 className="font-medium">Manager tools</h2>
          <p className="mt-1 text-xs text-muted">
            Overrides are recorded in the event&apos;s history with your name against them.
          </p>

          {round && round.closedAt === null ? (
            <div className="mt-4 space-y-4">
              {round.pairings
                .filter((p) => p.status !== "confirmed")
                .map((p) => (
                  <div key={p.id} className="rounded-lg border border-line bg-panel-2 p-3">
                    <p className="mb-2 text-sm">
                      {name(users, p.a)} <span className="text-muted">vs</span> {name(users, p.b)}
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
                      <ManagerScoreSelect aName={name(users, p.a)} bName={name(users, p.b)} />
                    </ActionForm>
                  </div>
                ))}
              {openCount > 0 ? (
                <ActionForm
                  action={forceCloseRoundAction}
                  fields={{ eventId: event.id }}
                  label="Force close round"
                  variant="danger"
                  confirm="Close with unplayed matches?"
                  compact
                />
              ) : null}
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Drop a player
            </h3>
            <ul className="space-y-2">
              {event.players
                .filter((p) => p.droppedAfterRound === null)
                .map((p) => (
                  <li key={p.userId} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{name(users, p.userId)}</span>
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
        </Panel>
      ) : null}

      {event.status === "complete" ? (
        <Panel className="border-win/40 bg-win/5">
          <p className="text-sm">
            Event complete after {event.rounds.length} round{event.rounds.length === 1 ? "" : "s"}.
            Results are saved to disk and will not change.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
