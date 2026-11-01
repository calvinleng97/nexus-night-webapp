import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listAllEvents, listLeagues } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  CountPill,
  Empty,
  Field,
  PageTitle,
  SectionHead,
  inputClass,
} from "@/components/ui";
import { createLeagueAction, joinLeagueAction } from "../actions";

export default async function LeaguesPage(props: PageProps<"/leagues">) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const { new: creating } = await props.searchParams;

  const [leagues, events] = await Promise.all([listLeagues(), listAllEvents()]);
  const eventCount = new Map<string, number>();
  for (const e of events) eventCount.set(e.leagueId, (eventCount.get(e.leagueId) ?? 0) + 1);

  const mine = leagues.filter((l) => l.memberIds.includes(userId));
  const others = leagues.filter((l) => !l.memberIds.includes(userId));

  return (
    <div>
      <PageTitle>Leagues</PageTitle>

      <SectionHead
        action={
          creating ? null : (
            <Link
              href="/leagues?new=1"
              aria-label="Create a league"
              title="Create a league"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-hair bg-raised text-base leading-none text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
            >
              <span aria-hidden>+</span>
            </Link>
          )
        }
      >
        Yours
      </SectionHead>

      {creating ? (
        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">New league</h3>
            <Link href="/leagues" className="px-1 text-sm text-fg-faint hover:text-fg">
              Cancel
            </Link>
          </div>
          <ActionForm action={createLeagueAction} label="Create league" variant="primary">
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
      ) : null}

      {mine.length === 0 && !creating ? (
        <Empty>
          No leagues yet — tap <span className="text-fg-dim">+</span> to make one.
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {mine.map((l) => {
            const n = eventCount.get(l.id) ?? 0;
            return (
              <Card as="li" key={l.id} interactive>
                <Link href={`/leagues/${l.id}`} className="block p-4">
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate font-medium">{l.name}</p>
                    {l.managerIds.includes(userId) ? <Badge tone="accent">★ Manager</Badge> : null}
                    <span aria-hidden className="text-fg-faint">
                      →
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CountPill
                      value={n}
                      label={n === 1 ? "event" : "events"}
                      tone={n > 0 ? "accent" : "plain"}
                    />
                    <CountPill
                      value={l.memberIds.length}
                      label={l.memberIds.length === 1 ? "player" : "players"}
                    />
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}

      {others.length > 0 ? (
        <div className="mt-9">
          <SectionHead>Open to join</SectionHead>
          <ul className="space-y-2">
            {others.map((l) => (
              <Card as="li" key={l.id} tone="raised">
                <div className="flex flex-wrap items-center gap-3 p-3.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</p>
                  <CountPill
                    value={l.memberIds.length}
                    label={l.memberIds.length === 1 ? "player" : "players"}
                  />
                  <ActionForm
                    action={joinLeagueAction}
                    fields={{ leagueId: l.id }}
                    label="Join"
                    variant="primary"
                    compact
                  />
                </div>
              </Card>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
