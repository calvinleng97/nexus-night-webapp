import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import type { NexusEvent, UserId } from "@/lib/domain/types";
import { getUsers, listAllEvents, listLeagues } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { EventCard, type WhoFn } from "@/components/event-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { NowCard } from "@/components/now-card";
import {
  Card,
  Chevron,
  Crest,
  CountPill,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Pill,
  Section,
  codeInputClass,
  inputClass,
} from "@/components/ui";
import { createLeagueAction, joinByCodeAction, joinEventAction } from "../actions";

/** Undated events go last; otherwise soonest first. */
function bySoonest(a: NexusEvent, b: NexusEvent): number {
  if (!a.scheduledFor) return b.scheduledFor ? 1 : a.createdAt.localeCompare(b.createdAt);
  if (!b.scheduledFor) return -1;
  return a.scheduledFor.localeCompare(b.scheduledFor);
}

/**
 * Home: what's happening tonight, what's coming up, and your leagues — in
 * the order you'd want them on opening the app.
 */
export default async function HomePage(props: PageProps<"/leagues">) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const { new: creating } = await props.searchParams;

  const [leagues, events] = await Promise.all([listLeagues(), listAllEvents()]);
  // Leagues you are not in are not listed: a join code is the only way in.
  const mine = leagues.filter((l) => l.memberIds.includes(userId));
  const mineIds = new Set(mine.map((l) => l.id));
  const leagueName = new Map(mine.map((l) => [l.id, l.name]));
  const inMine = events.filter((e) => mineIds.has(e.leagueId));

  const live = inMine.filter((e) => e.status === "running");
  const playing = live.filter((e) => e.players.some((p) => p.userId === userId));
  const watching = live.filter((e) => !playing.includes(e));
  const upcoming = inMine.filter((e) => e.status === "draft").sort(bySoonest);

  const eventCount = new Map<string, number>();
  for (const e of inMine) {
    if (e.status === "cancelled") continue;
    eventCount.set(e.leagueId, (eventCount.get(e.leagueId) ?? 0) + 1);
  }

  const users = await getUsers([
    ...new Set([...live, ...upcoming].flatMap((e) => e.players.map((p) => p.userId))),
  ]);
  const who: WhoFn = (id: UserId) => {
    const u = users.get(id);
    return { name: u?.name ?? "Unknown", image: u?.image ?? null };
  };
  const showLeague = mine.length > 1;

  const createForm = (
    <Card className="mb-3 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">New league</h3>
        <Link href="/leagues" className="text-sm text-fg-dim hover:text-fg">
          Cancel
        </Link>
      </div>
      <ActionForm action={createLeagueAction} label="Create league" variant="solid" full>
        <div className="mb-3">
          <Field label="Name">
            <input
              name="name"
              required
              autoFocus
              maxLength={80}
              className={inputClass}
              placeholder="Thursday Nexus"
            />
          </Field>
        </div>
      </ActionForm>
    </Card>
  );

  const joinForm = (
    <ActionForm action={joinByCodeAction} label="Join" variant="primary" className="flex flex-wrap items-center gap-2 [&>p]:basis-full [&>ul]:basis-full">
      <input
        name="code"
        required
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label="Join code"
        className={`${codeInputClass} h-10 min-w-0 flex-1 !py-0 !text-base`}
        placeholder="CODE"
      />
    </ActionForm>
  );

  // First visit: nothing to show but the two ways in.
  if (mine.length === 0)
    return (
      <div>
        <PageHeader title="Welcome" />
        {creating ? createForm : null}
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Got a join code?</h2>
          {joinForm}
        </Card>
        {creating ? null : (
          <div className="mt-4">
            <LinkButton href="/leagues?new=1" variant="ghost" full>
              + Start a new league
            </LinkButton>
          </div>
        )}
      </div>
    );

  return (
    <div>
      {playing.length > 0 ? (
        <Section title="Live now">
          <ul className="space-y-3">
            {playing.map((e) => (
              <NowCard key={e.id} event={e} userId={userId} who={who} />
            ))}
          </ul>
          {playing.map((e) => (
            <LiveRefresh key={e.id} eventId={e.id} />
          ))}
        </Section>
      ) : null}

      {watching.length > 0 ? (
        <Section title={playing.length > 0 ? "Also live" : "Live now"}>
          <ul className="space-y-3">
            {watching.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                href={`/events/${e.id}`}
                who={who}
                subtitle={showLeague ? leagueName.get(e.leagueId) : undefined}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Upcoming" count={upcoming.length || undefined}>
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
                  subtitle={showLeague ? leagueName.get(e.leagueId) : undefined}
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

      <Section
        title="Leagues"
        action={
          creating ? null : (
            <LinkButton href="/leagues?new=1" size="sm" variant="ghost">
              + New
            </LinkButton>
          )
        }
      >
        {creating ? createForm : null}
        <Card className="overflow-hidden">
          <ul className="divide-y divide-hair-soft">
            {mine.map((l) => {
              const n = eventCount.get(l.id) ?? 0;
              return (
                <li key={l.id}>
                  <Link
                    href={`/leagues/${l.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                  >
                    <Crest name={l.name} seed={l.id} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{l.name}</span>
                        {l.managerIds.includes(userId) ? (
                          <span title="You manage this league" className="text-xs text-accent">
                            ★
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <CountPill value={l.memberIds.length} label={l.memberIds.length === 1 ? "player" : "players"} />
                    <span className="hidden sm:inline">
                      <CountPill value={n} label={n === 1 ? "event" : "events"} />
                    </span>
                    <Chevron />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-hair-soft bg-ink/40 px-4 py-3">{joinForm}</div>
        </Card>
      </Section>
    </div>
  );
}
