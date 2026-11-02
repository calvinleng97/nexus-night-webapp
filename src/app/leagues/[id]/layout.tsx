import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getLeague } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { LeagueTabs } from "@/components/league-tabs";
import { BackLink, Card, MicroLabel, PageTitle, codeInputClass } from "@/components/ui";
import { joinLeagueAction, rotateJoinCodeAction } from "../../actions";

/**
 * Shared frame for a league: title, invite code, and the Events / Players /
 * Decks tabs. Non-members get the join form instead of any tab.
 *
 * Each page under here still checks membership itself — a layout is not a
 * guard, since pages can render without it re-running.
 */
export default async function LeagueLayout(props: LayoutProps<"/leagues/[id]">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();
  const isMember = league.memberIds.includes(userId);
  const isManager = league.managerIds.includes(userId);

  return (
    <div>
      <BackLink href="/leagues">Leagues</BackLink>
      <div className="mt-3">
        <PageTitle>{league.name}</PageTitle>
      </div>

      {isMember ? (
        <>
          <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Invite code
            </span>
            <span className="select-all rounded-md border border-hair bg-raised px-2 py-0.5 font-mono text-sm uppercase tracking-[0.2em] text-accent">
              {league.joinCode}
            </span>
            {isManager ? (
              <ActionForm
                action={rotateJoinCodeAction}
                fields={{ leagueId: league.id }}
                label="New code"
                variant="ghost"
                confirm="Replace the code"
                compact
                className="[&_button]:px-2 [&_button]:py-0.5 [&_button]:text-xs"
              />
            ) : null}
          </div>
          <LeagueTabs leagueId={league.id} />
          {props.children}
        </>
      ) : (
        <Card className="p-5">
          <MicroLabel>Join code required</MicroLabel>
          <div className="mt-4">
            <ActionForm
              action={joinLeagueAction}
              fields={{ leagueId: league.id }}
              label="Join league"
              variant="solid"
              size="lg"
            >
              <input
                name="code"
                required
                autoFocus
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${codeInputClass} mb-3`}
                placeholder="ABC123"
              />
            </ActionForm>
          </div>
        </Card>
      )}
    </div>
  );
}
