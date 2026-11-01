import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { computeLeagueElo } from "@/lib/domain/elo";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import {
  BackLink,
  Badge,
  Card,
  CountPill,
  Empty,
  Field,
  PageTitle,
  SectionHead,
  Tag,
  inputClass,
} from "@/components/ui";
import {
  createEventAction,
  joinLeagueAction,
  leaveLeagueAction,
  removeMemberAction,
  setManagerAction,
} from "../../actions";

const STATUS_TONE = { draft: "neutral", running: "accent", complete: "win" } as const;

export default async function LeaguePage(props: PageProps<"/leagues/[id]">) {
  const { id } = await props.params;
  const { new: creating } = await props.searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();

  const [events, users] = await Promise.all([
    listEventsForLeague(id),
    getUsers(league.memberIds),
  ]);
  const isMember = league.memberIds.includes(userId);
  const isManager = league.managerIds.includes(userId);
  const cfg = loadConfig();
  // Derived on every view from the confirmed results on disk.
  const ratings = computeLeagueElo(events, league.memberIds, cfg.elo);
  const rated = ratings.some((r) => r.games > 0);

  return (
    <div>
      <BackLink href="/leagues">Leagues</BackLink>
      <div className="mt-3">
        <PageTitle>{league.name}</PageTitle>
      </div>

      {!isMember ? (
        <Card className="mb-7 flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-sm text-fg-dim">You&apos;re not in this league yet.</p>
          <ActionForm
            action={joinLeagueAction}
            fields={{ leagueId: league.id }}
            label="Join league"
            variant="primary"
            compact
          />
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- events */}
      <SectionHead
        action={
          isManager && !creating ? (
            <Link
              href={`/leagues/${league.id}?new=1`}
              aria-label="Create an event"
              title="Create an event"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-hair bg-raised text-base leading-none text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
            >
              <span aria-hidden>+</span>
            </Link>
          ) : null
        }
      >
        Events
      </SectionHead>

      {creating && isManager ? (
        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">New event</h3>
            <Link
              href={`/leagues/${league.id}`}
              className="px-1 text-sm text-fg-faint hover:text-fg"
            >
              Cancel
            </Link>
          </div>
          <ActionForm
            action={createEventAction}
            fields={{ leagueId: league.id }}
            label="Create event"
            variant="primary"
          >
            <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field label="Name">
                <input
                  name="name"
                  required
                  autoFocus
                  maxLength={80}
                  className={inputClass}
                  placeholder="Nexus Night #1"
                />
              </Field>
              <Field label="Rounds">
                <input
                  name="totalRounds"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={cfg.event.defaultRounds}
                  className={inputClass}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}

      {events.length === 0 ? (
        <Empty>
          {isManager ? (
            <>
              No events yet — tap <span className="text-fg-dim">+</span> to schedule one.
            </>
          ) : (
            "No events yet."
          )}
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {events.map((e) => (
            <Card as="li" key={e.id} interactive tone={e.status === "running" ? "accent" : "plain"}>
              <Link href={`/events/${e.id}`} className="block p-4">
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 truncate font-medium">{e.name}</p>
                  <Badge tone={STATUS_TONE[e.status]}>
                    {e.status === "running"
                      ? `Round ${e.rounds.length}`
                      : e.status === "complete"
                        ? "Final"
                        : "Draft"}
                  </Badge>
                  <span aria-hidden className="text-fg-faint">
                    →
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.players.length === 0 ? (
                    <Tag tone="warn">Needs players</Tag>
                  ) : (
                    <CountPill
                      value={e.players.length}
                      label={e.players.length === 1 ? "player" : "players"}
                      tone={e.status === "running" ? "accent" : "plain"}
                    />
                  )}
                  <CountPill value={e.totalRounds} label="rounds" />
                </div>
              </Link>
            </Card>
          ))}
        </ul>
      )}

      {/* --------------------------------------------------------- players */}
      <div className="mt-9">
        <SectionHead count={league.memberIds.length}>Players</SectionHead>
        {/* A table, deliberately a different shape from the event cards above,
            so events and people never read as one list. */}
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-fg-faint">
                <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
                <th className="py-2.5 pr-2 font-medium">Player</th>
                <th className="py-2.5 pr-2 text-right font-medium">Elo</th>
                <th className="py-2.5 pr-4 text-right font-medium">W&ndash;L</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => {
                const memberIsManager = league.managerIds.includes(r.userId);
                const delta = r.lastDelta;
                return (
                  <tr
                    key={r.userId}
                    className={`border-b border-hair-soft last:border-0 ${
                      r.userId === userId ? "bg-accent/5" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-4 pr-2 text-fg-faint">{rated ? r.rank : "·"}</td>
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-1.5">
                        {memberIsManager ? (
                          <span aria-label="Manager" title="Manager" className="text-accent">
                            ★
                          </span>
                        ) : null}
                        <span
                          className={`min-w-0 truncate ${
                            r.userId === userId ? "text-accent" : ""
                          }`}
                        >
                          {users.get(r.userId)?.name ?? "Unknown"}
                        </span>
                        {r.games === 0 ? <Badge>new</Badge> : null}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className="font-mono tabular-nums">{r.rating}</span>
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={`ml-1.5 font-mono text-xs tabular-nums ${
                            delta > 0 ? "text-win" : "text-loss"
                          }`}
                        >
                          {delta > 0 ? "▲" : "▼"}
                          {Math.abs(delta)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-fg-dim">
                      {r.games === 0
                        ? "—"
                        : r.draws > 0
                          ? `${r.wins}-${r.losses}-${r.draws}`
                          : `${r.wins}-${r.losses}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {isManager ? (
          <details className="group mt-4">
            <summary className="cursor-pointer list-none text-sm text-fg-faint transition-colors hover:text-fg">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
              Manage players
            </summary>
            <ul className="mt-3 divide-y divide-hair-soft">
              {league.memberIds.map((m) => {
                const memberIsManager = league.managerIds.includes(m);
                if (m === league.createdBy) return null;
                return (
                  <li key={m} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {users.get(m)?.name ?? "Unknown"}
                    </span>
                    {memberIsManager ? <Badge tone="accent">Manager</Badge> : null}
                    <ActionForm
                      action={setManagerAction}
                      fields={{
                        leagueId: league.id,
                        targetId: m,
                        make: memberIsManager ? "0" : "1",
                      }}
                      label={memberIsManager ? "Demote" : "Make manager"}
                      variant="ghost"
                      compact
                    />
                    <ActionForm
                      action={removeMemberAction}
                      fields={{ leagueId: league.id, targetId: m }}
                      label="Remove"
                      variant="danger"
                      confirm="Remove from league"
                      compact
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}

        {isMember && league.createdBy !== userId ? (
          <div className="mt-8 border-t border-hair-soft pt-6">
            <ActionForm
              action={leaveLeagueAction}
              fields={{ leagueId: league.id }}
              label="Leave league"
              variant="danger"
              confirm="Confirm leave"
              compact
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
