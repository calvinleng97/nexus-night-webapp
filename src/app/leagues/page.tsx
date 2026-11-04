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
  codeInputClass,
  inputClass,
} from "@/components/ui";
import { createLeagueAction, joinByCodeAction } from "../actions";

export default async function LeaguesPage(props: PageProps<"/leagues">) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const { new: creating } = await props.searchParams;

  const [leagues, events] = await Promise.all([listLeagues(), listAllEvents()]);
  const eventCount = new Map<string, number>();
  // Cancelled events are gone as far as the count is concerned.
  for (const e of events) {
    if (e.status === "cancelled") continue;
    eventCount.set(e.leagueId, (eventCount.get(e.leagueId) ?? 0) + 1);
  }

  // Leagues you are not in are not listed: a join code is the only way in.
  const mine = leagues.filter((l) => l.memberIds.includes(userId));

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

      <div className="mt-9">
        <SectionHead>Join a league</SectionHead>
        <Card className="p-4">
          <ActionForm action={joinByCodeAction} label="Join" variant="primary">
            <div className="mb-3">
              <Field label="Join code">
                <input
                  name="code"
                  required
                  maxLength={12}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={codeInputClass}
                  placeholder="ABC123"
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
