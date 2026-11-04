import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { eventDateParts } from "@/lib/domain/schedule";
import { getLeague, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, Field, inputClass } from "@/components/ui";
import { createEventAction } from "../../actions";

const STATUS_TONE = { draft: "accent", running: "accent", complete: "win", cancelled: "loss" } as const;
const STATUS_LABEL = { draft: "Open", running: "Live", complete: "Final", cancelled: "Cancelled" } as const;

/** The Events tab: every event in the league, and creating new ones. */
export default async function LeagueEventsPage(props: PageProps<"/leagues/[id]">) {
  const { id } = await props.params;
  const { new: creating } = await props.searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();
  // The layout shows the join form to non-members; render nothing here.
  if (!league.memberIds.includes(userId)) return null;

  const events = await listEventsForLeague(id);
  const isManager = league.managerIds.includes(userId);
  const cfg = loadConfig();

  return (
    <div>
      {isManager && !creating ? (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/leagues/${league.id}?new=1`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <span aria-hidden>+</span> New event
          </Link>
        </div>
      ) : null}

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
            const live = e.status === "draft" || e.status === "running";
            return (
              <Card
                as="li"
                key={e.id}
                interactive
                tone={live ? "accent" : "plain"}
                className={live ? "" : "opacity-75"}
              >
                {/* Once started, what people want is their match: open on Bracket. */}
                <Link
                  href={e.status === "draft" ? `/events/${e.id}` : `/events/${e.id}/bracket`}
                  className="flex items-stretch gap-4 p-4 sm:p-5"
                >
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
                        <span
                          className={`mt-1.5 w-full border-t pt-1.5 text-center font-mono text-xs tabular-nums ${
                            live ? "border-accent/25 text-fg" : "border-hair text-fg-dim"
                          }`}
                        >
                          {when.time}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
                        TBD
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-lg font-semibold">{e.name}</p>
                      <Badge tone={STATUS_TONE[e.status]}>
                        {e.status === "running"
                          ? `Round ${e.rounds.length}`
                          : STATUS_LABEL[e.status]}
                      </Badge>
                    </div>
                    {e.status === "draft" ? (
                      <p
                        className={`mt-3 text-sm font-medium ${joined ? "text-win" : "text-accent"}`}
                      >
                        {joined ? "✓ You're in" : "Sign up →"}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
