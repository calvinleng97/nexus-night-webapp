import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { disputedCount } from "@/lib/domain/my-match";
import { getEvent, getLeague } from "@/lib/store/repo";
import { LiveRefresh } from "@/components/live-refresh";
import { RouteTabs, type RouteTab } from "@/components/route-tabs";
import { EventTicket } from "@/components/event-bits";
import { Card, CountPill, LinkButton, StatusPill } from "@/components/ui";

/** Shared frame for an event: its ticket header and the tabs. */
export default async function EventLayout(props: LayoutProps<"/events/[id]">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();
  const league = await getLeague(event.leagueId);
  const back = league ? `/leagues/${league.id}` : "/leagues";

  // A cancelled event has nothing left to show: no tabs, no registration.
  if (event.status === "cancelled")
    return (
      <div>
        <EventTicket event={event} league={league} pills={<StatusPill status="cancelled" />} />
        <Card className="flex flex-col items-center gap-6 px-5 py-12 text-center">
          <p className="text-2xl font-semibold text-loss">Event cancelled</p>
          <LinkButton href={back} variant="solid">
            ← Back to {league?.name ?? "home"}
          </LinkButton>
        </Card>
      </div>
    );

  const isManager = event.managerIds.includes(userId);
  const live = event.status === "draft" || event.status === "running";
  const active = event.players.filter((p) => p.droppedAfterRound === null).length;

  const tabs: RouteTab[] = [
    {
      segment: null,
      label: event.status === "draft" ? "Sign-ups" : event.status === "complete" ? "Results" : "Tonight",
    },
    // Nothing to show under Rounds until round 1 is paired.
    ...(event.rounds.length > 0 ? [{ segment: "bracket", label: "Rounds" }] : []),
    { segment: "players", label: "Players" },
  ];
  if (isManager && live) tabs.push({ segment: "manage", label: "Manage", alert: disputedCount(event) });

  return (
    <div>
      <EventTicket
        event={event}
        league={league}
        pills={
          <>
            <StatusPill
              status={event.status}
              round={event.rounds.length}
              totalRounds={event.totalRounds}
            />
            <CountPill value={active} label={active === 1 ? "player" : "players"} />
            {event.status === "draft" ? (
              <CountPill value={event.totalRounds} label={event.totalRounds === 1 ? "round" : "rounds"} />
            ) : null}
          </>
        }
      />

      <RouteTabs base={`/events/${event.id}`} label="Event" tabs={tabs} />
      {props.children}
      {live ? <LiveRefresh eventId={event.id} /> : null}
    </div>
  );
}
