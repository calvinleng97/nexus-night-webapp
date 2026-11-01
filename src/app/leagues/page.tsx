import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getUsers, listLeagues } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Panel, PageTitle, inputClass } from "@/components/ui";
import { createLeagueAction, joinLeagueAction } from "../actions";

export default async function LeaguesPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const leagues = await listLeagues();
  const users = await getUsers(leagues.flatMap((l) => l.memberIds));
  const mine = leagues.filter((l) => l.memberIds.includes(userId));
  const others = leagues.filter((l) => !l.memberIds.includes(userId));

  return (
    <div className="space-y-6">
      <PageTitle sub="Any signed-in player can see and join any league.">Leagues</PageTitle>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Yours</h2>
        {mine.length === 0 ? (
          <Empty>You haven&apos;t joined a league yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {mine.map((l) => (
              <Panel as="li" key={l.id}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leagues/${l.id}`} className="font-medium hover:text-accent">
                      {l.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {l.memberIds.length} member{l.memberIds.length === 1 ? "" : "s"}
                      {l.description ? ` · ${l.description}` : ""}
                    </p>
                  </div>
                  {l.managerIds.includes(userId) ? <Badge tone="accent">Manager</Badge> : null}
                </div>
              </Panel>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open to join</h2>
          <ul className="space-y-3">
            {others.map((l) => (
              <Panel as="li" key={l.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      run by {users.get(l.createdBy)?.name ?? "someone"} ·{" "}
                      {l.memberIds.length} member{l.memberIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ActionForm
                    action={joinLeagueAction}
                    fields={{ leagueId: l.id }}
                    label="Join"
                    variant="primary"
                    compact
                  />
                </div>
              </Panel>
            ))}
          </ul>
        </section>
      ) : null}

      <Panel>
        <h2 className="mb-3 font-medium">Start a new league</h2>
        <ActionForm action={createLeagueAction} label="Create league" variant="primary">
          <div className="mb-3 space-y-3">
            <Field label="Name">
              <input name="name" required maxLength={80} className={inputClass} placeholder="Thursday Nexus Night" />
            </Field>
            <Field label="Description" hint="Optional.">
              <input name="description" maxLength={500} className={inputClass} placeholder="Weekly at my place" />
            </Field>
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
