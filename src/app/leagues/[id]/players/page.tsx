import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { computeLeagueElo } from "@/lib/domain/elo";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { Badge, Card } from "@/components/ui";
import { leaveLeagueAction, removeMemberAction, setManagerAction } from "../../../actions";

/** The Players tab: league ratings, plus member management for managers. */
export default async function LeaguePlayersPage(props: PageProps<"/leagues/[id]/players">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();
  if (!league.memberIds.includes(userId)) redirect(`/leagues/${id}`);

  const [events, users] = await Promise.all([
    listEventsForLeague(id),
    getUsers(league.memberIds),
  ]);
  const isManager = league.managerIds.includes(userId);
  // Derived on every view from the confirmed results on disk.
  const ratings = computeLeagueElo(events, league.memberIds, loadConfig().elo);

  return (
    <div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-fg-faint">
              <th className="py-2.5 pl-4 pr-2 font-medium">Player</th>
              <th className="py-2.5 pr-2 text-right font-medium">Elo</th>
              <th className="py-2.5 pr-4 text-right font-medium">W&ndash;L</th>
            </tr>
          </thead>
          <tbody>
            {ratings.map((r) => {
              const memberIsManager = league.managerIds.includes(r.userId);
              const delta = r.lastDelta;
              return (
                <tr
                  key={r.userId}
                  className={`border-b border-hair-soft last:border-0 ${
                    r.userId === userId ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="py-2.5 pl-4 pr-2">
                    <span className="flex items-center gap-1.5">
                      {memberIsManager ? (
                        <span aria-label="Manager" title="Manager" className="text-accent">
                          ★
                        </span>
                      ) : null}
                      <span
                        className={`min-w-0 truncate ${
                          r.userId === userId ? "text-accent" : ""
                        }`}
                      >
                        {users.get(r.userId)?.name ?? "Unknown"}
                      </span>
                      {r.games === 0 ? <Badge>new</Badge> : null}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <span className="font-mono tabular-nums">{r.rating}</span>
                    {delta !== null && delta !== 0 ? (
                      <span
                        className={`ml-1.5 font-mono text-xs tabular-nums ${
                          delta > 0 ? "text-win" : "text-loss"
                        }`}
                      >
                        {delta > 0 ? "▲" : "▼"}
                        {Math.abs(delta)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-fg-dim">
                    {r.games === 0
                      ? "—"
                      : r.draws > 0
                        ? `${r.wins}-${r.losses}-${r.draws}`
                        : `${r.wins}-${r.losses}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {isManager ? (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm text-fg-faint transition-colors hover:text-fg">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
            Manage players
          </summary>
          <ul className="mt-3 divide-y divide-hair-soft">
            {league.memberIds.map((m) => {
              const memberIsManager = league.managerIds.includes(m);
              if (m === league.createdBy) return null;
              return (
                <li key={m} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {users.get(m)?.name ?? "Unknown"}
                  </span>
                  {memberIsManager ? <Badge tone="accent">Manager</Badge> : null}
                  <ActionForm
                    action={setManagerAction}
                    fields={{
                      leagueId: league.id,
                      targetId: m,
                      make: memberIsManager ? "0" : "1",
                    }}
                    label={memberIsManager ? "Demote" : "Make manager"}
                    variant="ghost"
                    compact
                  />
                  <ActionForm
                    action={removeMemberAction}
                    fields={{ leagueId: league.id, targetId: m }}
                    label="Remove"
                    variant="danger"
                    confirm="Remove from league"
                    compact
                  />
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {league.createdBy !== userId ? (
        <div className="mt-8 border-t border-hair-soft pt-6">
          <ActionForm
            action={leaveLeagueAction}
            fields={{ leagueId: league.id }}
            label="Leave league"
            variant="danger"
            confirm="Confirm leave"
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
