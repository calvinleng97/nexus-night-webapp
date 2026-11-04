import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { UserId } from "@/lib/domain/types";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { EventCard, PastEventRow, type WhoFn } from "@/components/event-bits";
import {
  Card,
  Empty,
  Field,
  LinkButton,
  Pill,
  Section,
  inputClass,
} from "@/components/ui";
import { createEventAction, joinEventAction } from "../../actions";

/** The Events tab: live, upcoming and past, plus creating new ones. */
export default async function LeagueEventsPage(props: PageProps<"/leagues/[id]">) {
  const { id } = await props.params;
  const { new: creating } = await props.searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();
  // The layout shows the join form to non-members; render nothing here.
  if (!league.memberIds.includes(userId)) return null;

  // Cancelled events are gone as far as the list is concerned.
  const events = (await listEventsForLeague(id)).filter((e) => e.status !== "cancelled");
  const isManager = league.managerIds.includes(userId);
  const cfg = loadConfig();

  const live = events.filter((e) => e.status === "running");
  const upcoming = events
    .filter((e) => e.status === "draft")
    // Soonest first; listEventsForLeague hands them over newest first.
    .reverse();
  const past = events.filter((e) => e.status === "complete");

  const users = await getUsers([
    ...new Set([...live, ...upcoming].flatMap((e) => e.players.map((p) => p.userId))),
  ]);
  const who: WhoFn = (uid: UserId) => {
    const u = users.get(uid);
    return { name: u?.name ?? "Unknown", image: u?.image ?? null };
  };

  const newButton =
    isManager && !creating ? (
      <LinkButton href={`/leagues/${league.id}?new=1`} variant="primary" size="sm">
        + New event
      </LinkButton>
    ) : null;

  return (
    <div>
      {creating && isManager ? (
        <Card className="mb-8 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[1.05rem] font-semibold">New event</h3>
            <Link href={`/leagues/${league.id}`} className="text-sm text-fg-dim hover:text-fg">
              Cancel
            </Link>
          </div>
          <ActionForm
            action={createEventAction}
            fields={{ leagueId: league.id }}
            label="Create event"
            variant="solid"
            size="lg"
          >
            <div className="mb-4 space-y-4">
              <Field label="Name">
                <input
                  name="name"
                  required
                  autoFocus
                  maxLength={80}
                  className={inputClass}
                  placeholder={`Nexus Night #${events.length + 1}`}
                />
              </Field>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="When">
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

      {live.length > 0 ? (
        <Section title="Live now">
          <ul className="space-y-3">
            {live.map((e) => (
              <EventCard key={e.id} event={e} href={`/events/${e.id}`} who={who} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Upcoming" action={newButton}>
        {upcoming.length === 0 ? (
          <Empty>Nothing scheduled.</Empty>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => {
              const joined = e.players.some((p) => p.userId === userId);
              return (
                <EventCard
                  key={e.id}
                  event={e}
                  href={`/events/${e.id}`}
                  who={who}
                  trailing={
                    joined ? (
                      <Pill tone="win">✓ In</Pill>
                    ) : (
                      <ActionForm
                        action={joinEventAction}
                        fields={{ eventId: e.id }}
                        label="Join"
                        variant="solid"
                        size="sm"
                      />
                    )
                  }
                />
              );
            })}
          </ul>
        )}
      </Section>

      {past.length > 0 ? (
        <Section title="Past" count={past.length}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {past.map((e) => {
                const me = computeStandings(e).find((s) => s.userId === userId);
                return (
                  <PastEventRow
                    key={e.id}
                    event={e}
                    href={`/events/${e.id}`}
                    mine={me ? recordLabel(me) : null}
                  />
                );
              })}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
