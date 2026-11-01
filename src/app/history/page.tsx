import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { matchHistory, recordString, summarize } from "@/lib/domain/history";
import type { UserId } from "@/lib/domain/types";
import { getUsers, listEventsForUser, listLeagues } from "@/lib/store/repo";
import { Badge, Card, Empty, PageTitle, Score, SectionHead } from "@/components/ui";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-lg tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[0.7rem] uppercase tracking-wide text-fg-faint">{label}</div>
    </div>
  );
}

const RESULT_TONE = {
  win: "win",
  loss: "loss",
  draw: "draw",
  bye: "accent",
  pending: "neutral",
} as const;

export default async function HistoryPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const events = await listEventsForUser(userId);
  const entries = matchHistory(events, userId);
  const totals = summarize(entries);

  const leagues = await listLeagues();
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));
  const users = await getUsers(
    entries.map((e) => e.opponentId).filter((x): x is UserId => x !== null),
  );
  const nameOf = (id: UserId | null) => (id ? (users.get(id)?.name ?? "Unknown") : "—");

  if (entries.length === 0)
    return (
      <div>
        <PageTitle>History</PageTitle>
        <Empty>
          No matches yet. Join an event from{" "}
          <Link href="/leagues" className="text-fg-dim underline hover:text-fg">
            your leagues
          </Link>
          .
        </Empty>
      </div>
    );

  // Group by event, preserving the newest-first order of the entries.
  const byEvent: Array<{ id: string; name: string; leagueId: string; rows: typeof entries }> = [];
  for (const e of entries) {
    const last = byEvent[byEvent.length - 1];
    if (last && last.id === e.eventId) last.rows.push(e);
    else byEvent.push({ id: e.eventId, name: e.eventName, leagueId: e.leagueId, rows: [e] });
  }

  return (
    <div>
      <PageTitle>History</PageTitle>

      <Card className="mb-9 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-hair-soft sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Match record" value={recordString(totals)} />
          <Stat label="Games" value={`${totals.gamesWon}–${totals.gamesLost}`} />
          <Stat
            label="Win rate"
            value={
              totals.matches > 0 ? `${Math.round((totals.wins / totals.matches) * 100)}%` : "—"
            }
          />
          <Stat label="Events" value={String(totals.events)} />
        </div>
        <div className="border-t border-hair-soft px-4 py-2.5 text-xs text-fg-faint">
          {totals.matches} match{totals.matches === 1 ? "" : "es"} played ·{" "}
          {totals.opponents} distinct opponent{totals.opponents === 1 ? "" : "s"}
          {totals.byes > 0 ? ` · ${totals.byes} bye${totals.byes === 1 ? "" : "s"}` : ""}
        </div>
      </Card>

      {byEvent.map((group) => {
        const played = group.rows.filter((r) => r.result !== "pending" && r.result !== "bye");
        const wins = played.filter((r) => r.result === "win").length;
        const draws = played.filter((r) => r.result === "draw").length;
        const losses = played.length - wins - draws;
        return (
          <div key={group.id} className="mb-7">
            <SectionHead
              action={
                <span className="font-mono text-xs tabular-nums text-fg-faint">
                  {recordString({ wins, losses, draws })}
                </span>
              }
            >
              <Link href={`/events/${group.id}`} className="hover:text-fg-dim">
                {group.name}
              </Link>
              <span className="ml-1.5 font-normal normal-case tracking-normal text-fg-faint/70">
                {leagueName.get(group.leagueId) ?? ""}
              </span>
            </SectionHead>

            <Card className="overflow-hidden">
              <ul className="divide-y divide-hair-soft">
                {[...group.rows]
                  .sort((a, b) => a.roundNumber - b.roundNumber)
                  .map((r) => (
                    <li key={`${r.eventId}-${r.roundNumber}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-7 shrink-0 font-mono text-xs text-fg-faint">
                        R{r.roundNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.result === "bye" ? (
                          <span className="text-fg-faint">Bye</span>
                        ) : (
                          <>
                            <span className="text-fg-faint">vs </span>
                            {nameOf(r.opponentId)}
                          </>
                        )}
                      </span>
                      {r.result === "pending" ? (
                        <span className="text-xs text-fg-faint">not reported</span>
                      ) : r.result === "bye" ? (
                        <Badge tone="accent">bye</Badge>
                      ) : (
                        <>
                          <Score mine={r.mine} theirs={r.theirs} />
                          <Badge tone={RESULT_TONE[r.result]}>
                            {r.result === "win" ? "W" : r.result === "loss" ? "L" : "D"}
                          </Badge>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
