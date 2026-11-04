import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { formatEventDate } from "@/lib/domain/schedule";
import { getEvent, getLeague } from "@/lib/store/repo";
import { LiveRefresh } from "@/components/live-refresh";
import { RouteTabs } from "@/components/route-tabs";
import { BackLink, DateChip, PageTitle, Tag } from "@/components/ui";

/** Shared frame for an event: title, date, state, and the tabs. */
export default async function EventLayout(props: LayoutProps<"/events/[id]">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();
  const league = await getLeague(event.leagueId);
  const date = formatEventDate(event.scheduledFor);

  return (
    <div>
      <BackLink href={league ? `/leagues/${league.id}` : "/leagues"}>
        {league?.name ?? "Leagues"}
      </BackLink>
      <div className="mt-3">
        <PageTitle>{event.name}</PageTitle>
      </div>
      <div className="-mt-3 mb-6 flex flex-wrap gap-2">
        {date ? <DateChip tone="accent">{date}</DateChip> : null}
        {event.status === "draft" ? <Tag tone="accent">Open for sign-ups</Tag> : null}
        {event.status === "running" ? (
          <Tag tone="accent">
            Round {event.rounds.length} of {event.totalRounds}
          </Tag>
        ) : null}
        {event.status === "complete" ? <Tag>Final</Tag> : null}
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
      {event.status !== "complete" ? <LiveRefresh eventId={event.id} /> : null}
    </div>
  );
}
