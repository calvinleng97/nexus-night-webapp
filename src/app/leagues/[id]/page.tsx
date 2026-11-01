import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import {
  BackLink,
  Badge,
  Card,
  Empty,
  Field,
  PageTitle,
  SectionHead,
  inputClass,
} from "@/components/ui";
import {
  createEventAction,
  joinLeagueAction,
  leaveLeagueAction,
  setManagerAction,
} from "../../actions";

const STATUS_TONE = { draft: "neutral", running: "accent", complete: "win" } as const;
const STATUS_LABEL = { draft: "Open for signups", running: "In progress", complete: "Finished" };

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

  return (
    <div>
      <BackLink href="/leagues">Leagues</BackLink>
      <div className="mt-3">
        <PageTitle
          meta={`${league.memberIds.length} player${league.memberIds.length === 1 ? "" : "s"}`}
        >
          {league.name}
        </PageTitle>
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
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="mt-0.5 text-sm text-fg-faint">
                    {STATUS_LABEL[e.status]}
                    {" · "}
                    {e.players.length} player{e.players.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[e.status]}>
                  {e.status === "running" ? `R${e.rounds.length}` : e.status}
                </Badge>
                <span aria-hidden className="text-fg-faint">
                  →
                </span>
              </Link>
            </Card>
          ))}
        </ul>
      )}

      {/* --------------------------------------------------------- players */}
      <div className="mt-9">
        <SectionHead count={league.memberIds.length}>Players</SectionHead>
        {/* Deliberately a different shape from the event cards above: a dense
            grid of pills, so events and people never read as one list. */}
        <ul className="flex flex-wrap gap-2">
          {league.memberIds.map((m) => {
            const memberIsManager = league.managerIds.includes(m);
            return (
              <li
                key={m}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  m === userId
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-hair-soft bg-raised text-fg-dim"
                }`}
              >
                {memberIsManager ? (
                  <span aria-label="Manager" title="Manager" className="text-accent">
                    ★
                  </span>
                ) : null}
                <span className="max-w-[16ch] truncate">{users.get(m)?.name ?? "Unknown"}</span>
                {m === userId ? <span className="text-accent/60">you</span> : null}
              </li>
            );
          })}
        </ul>

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
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}

        {isMember && league.createdBy !== userId ? (
          <div className="mt-6">
            <ActionForm
              action={leaveLeagueAction}
              fields={{ leagueId: league.id }}
              label="Leave league"
              variant="ghost"
              confirm="Really leave?"
              compact
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
