import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getEvent, getLeague } from "@/lib/store/repo";
import { LiveRefresh } from "@/components/live-refresh";
import { RouteTabs } from "@/components/route-tabs";
import { BackLink, Card, PageTitle } from "@/components/ui";

/** Shared frame for an event: title and the tabs. */
export default async function EventLayout(props: LayoutProps<"/events/[id]">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();
  const league = await getLeague(event.leagueId);
  const eventsHref = league ? `/leagues/${league.id}` : "/leagues";

  // A cancelled event has nothing left to show: no tabs, no registration.
  if (event.status === "cancelled")
    return (
      <div>
        <BackLink href={eventsHref}>{league?.name ?? "Leagues"}</BackLink>
        <div className="mt-3">
          <PageTitle>{event.name}</PageTitle>
        </div>
        <Card className="flex flex-col items-center gap-6 px-5 py-12 text-center">
          <p className="text-2xl font-semibold text-loss">Event Cancelled</p>
          <Link
            href={eventsHref}
            className="inline-flex items-center justify-center rounded-xl border border-accent bg-accent px-5 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:bg-accent/90"
          >
            ← Back to events
          </Link>
        </Card>
      </div>
    );

  return (
    <div>
      <BackLink href={league ? `/leagues/${league.id}` : "/leagues"}>
        {league?.name ?? "Leagues"}
      </BackLink>
      <div className="mt-3">
        <PageTitle>{event.name}</PageTitle>
      </div>

      <RouteTabs
        base={`/events/${event.id}`}
        label="Event"
        tabs={[
          { segment: null, label: "Registration" },
          { segment: "players", label: "Players" },
          { segment: "bracket", label: "Bracket" },
        ]}
      />
      {props.children}
      {event.status === "draft" || event.status === "running" ? (
        <LiveRefresh eventId={event.id} />
      ) : null}
    </div>
  );
}
