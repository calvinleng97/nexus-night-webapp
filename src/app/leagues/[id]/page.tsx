import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Panel, PageTitle, inputClass } from "@/components/ui";
import {
  createEventAction,
  joinLeagueAction,
  leaveLeagueAction,
  setManagerAction,
} from "../../actions";

const STATUS_TONE = { draft: "neutral", running: "accent", complete: "win" } as const;

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();

  const events = await listEventsForLeague(id);
  const users = await getUsers(league.memberIds);
  const isMember = league.memberIds.includes(userId);
  const isManager = league.managerIds.includes(userId);
  const cfg = loadConfig();

  return (
    <div className="space-y-6">
      <PageTitle sub={league.description || undefined}>{league.name}</PageTitle>

      {!isMember ? (
        <Panel>
          <p className="mb-3 text-sm text-muted">You&apos;re not in this league yet.</p>
          <ActionForm
            action={joinLeagueAction}
            fields={{ leagueId: league.id }}
            label="Join league"
            variant="primary"
          />
        </Panel>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Events</h2>
        {events.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const round = e.rounds.length;
              return (
                <Panel as="li" key={e.id}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/events/${e.id}`} className="font-medium hover:text-accent">
                        {e.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-muted">
                        {e.players.length} player{e.players.length === 1 ? "" : "s"}
                        {e.status === "running" ? ` · round ${round} of ${e.totalRounds}` : ""}
                        {e.status === "draft" ? ` · ${e.totalRounds} rounds planned` : ""}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                  </div>
                </Panel>
              );
            })}
          </ul>
        )}
      </section>

      {isManager ? (
        <Panel>
          <h2 className="mb-3 font-medium">Create an event</h2>
          <ActionForm
            action={createEventAction}
            fields={{ leagueId: league.id }}
            label="Create event"
            variant="primary"
          >
            <div className="mb-3 space-y-3">
              <Field label="Name">
                <input name="name" required maxLength={80} className={inputClass} placeholder="Nexus Night #4" />
              </Field>
              <Field label="Rounds" hint={`Nexus Night standard is ${cfg.event.defaultRounds}.`}>
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
        </Panel>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Members ({league.memberIds.length})
        </h2>
        <Panel>
          <ul className="divide-y divide-line">
            {league.memberIds.map((m) => {
              const u = users.get(m);
              const memberIsManager = league.managerIds.includes(m);
              return (
                <li key={m} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 truncate">
                    {u?.name ?? "Unknown player"}
                    {m === userId ? <span className="text-muted"> (you)</span> : null}
                  </span>
                  {memberIsManager ? <Badge tone="accent">Manager</Badge> : null}
                  {isManager && m !== league.createdBy ? (
                    <ActionForm
                      action={setManagerAction}
                      fields={{ leagueId: league.id, targetId: m, make: memberIsManager ? "0" : "1" }}
                      label={memberIsManager ? "Demote" : "Make manager"}
                      variant="ghost"
                      compact
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
        {isMember && league.createdBy !== userId ? (
          <ActionForm
            action={leaveLeagueAction}
            fields={{ leagueId: league.id }}
            label="Leave league"
            variant="ghost"
            confirm="Really leave?"
            compact
          />
        ) : null}
      </section>
    </div>
  );
}
