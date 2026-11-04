import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { computeLeagueElo } from "@/lib/domain/elo";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { RowMenu } from "@/components/row-menu";
import { Avatar, Card, Pill, WinRate, thClass } from "@/components/ui";
import { leaveLeagueAction, removeMemberAction, setManagerAction } from "../../../actions";

/**
 * The Leaderboard tab: league ratings. It is also the member list, so a
 * manager's per-member actions sit in a ⋯ menu on each row rather than in a
 * second list of the same people.
 */
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
  const nameOf = (uid: string) => users.get(uid)?.name ?? "Unknown";

  // Rated players are ranked; the rest wait for their first game.
  let rank = 0;
  const rows = ratings.map((r) => ({ ...r, rank: r.games > 0 ? ++rank : null }));

  return (
    <div>
      {/* Not overflow-hidden: the row menus need to spill out of the card. */}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hair-soft text-left">
              <th className={`${thClass} w-12 pl-4 pr-1`}>#</th>
              <th className={`${thClass} pr-2`}>Player</th>
              <th className={`${thClass} pr-2 text-right`}>Elo</th>
              <th className={`${thClass} pr-2 text-right`}>Record</th>
              <th className={`${thClass} ${isManager ? "pr-1" : "pr-4"} hidden text-right sm:table-cell`}>Win rate</th>
              {isManager ? <th className="w-10 pr-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const me = r.userId === userId;
              const delta = r.lastDelta;
              const top = r.rank !== null && r.rank <= 3;
              return (
                <tr
                  key={r.userId}
                  className={`border-b border-hair-soft last:border-0 ${me ? "bg-accent/[0.06]" : ""}`}
                >
                  <td
                    className={`py-3 pl-4 pr-1 font-mono tabular-nums ${top ? "font-semibold text-accent" : "text-fg-faint"}`}
                  >
                    {r.rank ?? "–"}
                  </td>
                  <td className="py-3 pr-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={nameOf(r.userId)} image={users.get(r.userId)?.image} />
                      <span className={`min-w-0 truncate ${me ? "font-semibold text-accent" : ""}`}>
                        {nameOf(r.userId)}
                      </span>
                      {league.managerIds.includes(r.userId) ? (
                        <span aria-label="Manager" title={r.userId === league.createdBy ? "Owner" : "Manager"} className="text-xs text-accent">
                          ★
                        </span>
                      ) : null}
                      {r.games === 0 ? <Pill size="sm">new</Pill> : null}
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <span className="font-mono font-semibold tabular-nums">{r.rating}</span>
                    {delta !== null && delta !== 0 ? (
                      <span
                        className={`ml-1.5 inline-block w-8 text-left font-mono text-xs tabular-nums ${delta > 0 ? "text-win" : "text-loss"}`}
                      >
                        {delta > 0 ? "▲" : "▼"}
                        {Math.abs(delta)}
                      </span>
                    ) : (
                      <span className="ml-1.5 inline-block w-8" />
                    )}
                  </td>
                  <td className="py-3 pr-2 text-right font-mono tabular-nums text-fg-dim">
                    {r.games === 0
                      ? "—"
                      : r.draws > 0
                        ? `${r.wins}-${r.losses}-${r.draws}`
                        : `${r.wins}-${r.losses}`}
                    {/* Phones have no Win rate column: the meter rides under the record. */}
                    {r.games > 0 ? (
                      <WinRate
                        size="tile"
                        rate={r.wins / (r.wins + r.losses + r.draws)}
                        className="ml-auto w-12 [&>span]:mt-1.5 sm:hidden"
                      />
                    ) : null}
                  </td>
                  <td className={`hidden py-3 sm:table-cell ${isManager ? "pr-1" : "pr-4"}`}>
                    <WinRate
                      rate={r.games > 0 ? r.wins / (r.wins + r.losses + r.draws) : null}
                      className="ml-auto"
                    />
                  </td>
                  {isManager ? (
                    <td className="py-3 pr-2 text-right">
                      {r.userId === league.createdBy ? null : (
                        <RowMenu label={`Manage ${nameOf(r.userId)}`}>
                          <ActionForm
                            action={setManagerAction}
                            fields={{
                              leagueId: league.id,
                              targetId: r.userId,
                              make: league.managerIds.includes(r.userId) ? "0" : "1",
                            }}
                            label={league.managerIds.includes(r.userId) ? "Remove manager" : "Make manager"}
                            variant="ghost"
                            size="sm"
                          />
                          <ActionForm
                            action={removeMemberAction}
                            fields={{ leagueId: league.id, targetId: r.userId }}
                            label="Remove from league"
                            variant="ghost"
                            className="[&_button]:text-loss"
                            size="sm"
                            confirm="Yes, remove"
                          />
                        </RowMenu>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {league.createdBy !== userId ? (
        <div className="mt-10 flex justify-center">
          <ActionForm
            action={leaveLeagueAction}
            fields={{ leagueId: league.id }}
            label="Leave league"
            variant="ghost"
            size="sm"
            confirm="Leave this league?"
          />
        </div>
      ) : null}
    </div>
  );
}
