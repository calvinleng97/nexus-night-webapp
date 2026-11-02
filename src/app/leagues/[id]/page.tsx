import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { computeLeagueElo } from "@/lib/domain/elo";
import { eventDateParts } from "@/lib/domain/schedule";
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
  MicroLabel,
  SectionHead,
  Tag,
  codeInputClass,
  inputClass,
} from "@/components/ui";
import {
  createEventAction,
  joinLeagueAction,
  leaveLeagueAction,
  removeMemberAction,
  rotateJoinCodeAction,
  setManagerAction,
} from "../../actions";

const STATUS_TONE = { draft: "accent", running: "accent", complete: "win" } as const;
const STATUS_LABEL = { draft: "Open", running: "Live", complete: "Final" } as const;

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

  return (
    <div>
      <BackLink href="/leagues">Leagues</BackLink>
      <div className="mt-3">
        <PageTitle>{league.name}</PageTitle>
      </div>

      {!isMember ? (
        <Card className="p-5">
          <MicroLabel>Join code required</MicroLabel>
          <div className="mt-4">
            <ActionForm
              action={joinLeagueAction}
              fields={{ leagueId: league.id }}
              label="Join league"
              variant="solid"
              size="lg"
            >
              <input
                name="code"
                required
                autoFocus
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${codeInputClass} mb-3`}
                placeholder="ABC123"
              />
            </ActionForm>
          </div>
        </Card>
      ) : null}

      {isMember ? (
        <>
          {/* The code only matters when inviting someone, so it stays one
              small line rather than a section of its own. */}
          <div className="-mt-3 mb-8 flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Invite code
            </span>
            <span className="select-all rounded-md border border-hair bg-raised px-2 py-0.5 font-mono text-sm uppercase tracking-[0.2em] text-accent">
              {league.joinCode}
            </span>
            {isManager ? (
              <ActionForm
                action={rotateJoinCodeAction}
                fields={{ leagueId: league.id }}
                label="New code"
                variant="ghost"
                confirm="Replace the code"
                compact
                className="[&_button]:px-2 [&_button]:py-0.5 [&_button]:text-xs"
              />
            ) : null}
          </div>

      {/* ---------------------------------------------------------- events */}
      {/* Events are what people come here for, so they get a full-size
          heading and big cards; players below keep the small label + table. */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Events</h2>
        <div className="flex-1" />
        {isManager && !creating ? (
          <Link
            href={`/leagues/${league.id}?new=1`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <span aria-hidden>+</span> New event
          </Link>
        ) : null}
      </div>

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
            <div className="mb-3 space-y-3">
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
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <Field label="Date & time">
                  <input name="scheduledFor" type="datetime-local" className={inputClass} />
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
            </div>
          </ActionForm>
        </Card>
      ) : null}

      {events.length === 0 ? (
        <Empty>
          {isManager ? (
            <>
              No events yet — tap <span className="text-fg-dim">New event</span> to schedule one.
            </>
          ) : (
            "No events yet."
          )}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const when = eventDateParts(e.scheduledFor);
            const joined = e.players.some((p) => p.userId === userId);
            const live = e.status !== "complete";
            return (
              <Card
                as="li"
                key={e.id}
                interactive
                tone={live ? "accent" : "plain"}
                className={live ? "" : "opacity-75"}
              >
                <Link href={`/events/${e.id}`} className="flex items-stretch gap-4 p-4 sm:p-5">
                  {/* Calendar tile: the date is the first thing to read. */}
                  <div
                    className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2 ${
                      live ? "border-accent/35 bg-ink/40" : "border-hair bg-raised"
                    }`}
                  >
                    {when ? (
                      <>
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-faint">
                          {when.month}
                        </span>
                        <span
                          className={`font-mono text-2xl font-semibold leading-none tabular-nums ${
                            live ? "text-accent" : "text-fg"
                          }`}
                        >
                          {when.day}
                        </span>
                        <span className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-fg-faint">
                          {when.weekday}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
                        TBD
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-lg font-semibold">{e.name}</p>
                      <Badge tone={STATUS_TONE[e.status]}>
                        {e.status === "running"
                          ? `Round ${e.rounds.length}`
                          : STATUS_LABEL[e.status]}
                      </Badge>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {when ? <CountPill value={when.time} label="start" /> : null}
                      {e.players.length === 0 ? (
                        <Tag tone="warn">Needs players</Tag>
                      ) : (
                        <CountPill
                          value={e.players.length}
                          label={e.players.length === 1 ? "player" : "players"}
                        />
                      )}
                      <CountPill value={e.totalRounds} label="rounds" />
                    </div>
                    {e.status === "draft" ? (
                      <p className="mt-3 text-sm font-medium text-accent">
                        {joined ? "✓ You're signed up" : "Sign up →"}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}

      {/* --------------------------------------------------------- players */}
      <div className="mt-12">
        <SectionHead
          count={league.memberIds.length}
          action={
            <Link
              href={`/leagues/${league.id}/decks`}
              className="inline-flex items-center gap-1 rounded-lg border border-hair bg-raised px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
            >
              Decks
              <span aria-hidden>→</span>
            </Link>
          }
        >
          Players
        </SectionHead>
        {/* A table, deliberately a different shape from the event cards above,
            so events and people never read as one list. */}
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-fg-faint">
                <th className="py-2.5 pl-4 pr-2 font-medium">Player</th>
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
                    <td className="py-2.5 pl-4 pr-2">
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
        </>
      ) : null}
    </div>
  );
}
