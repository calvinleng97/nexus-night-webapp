import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getLeague, getUsers } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { RouteTabs } from "@/components/route-tabs";
import { AvatarStack, BackLink, Card, Crest, codeInputClass, hueOf } from "@/components/ui";
import { joinLeagueAction, rotateJoinCodeAction } from "../../actions";

/**
 * The league's banner: a hub, not an occasion. Its crest, colour wash and
 * segmented tabs are deliberately unlike an event's date-stub ticket, so you
 * can tell which of the two you're on without reading anything.
 */
function Banner({
  league,
  children,
}: {
  league: { id: string; name: string };
  children?: ReactNode;
}) {
  const hue = hueOf(league.id);
  return (
    <header className="relative mb-7 overflow-hidden rounded-3xl border border-hair-soft bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, oklch(0.42 0.1 ${hue} / 0.35), transparent 60%)`,
        }}
      />
      <div className="relative p-5 sm:p-6">
        <BackLink href="/leagues">Home</BackLink>
        <div className="mt-4 flex items-center gap-4">
          <Crest name={league.name} seed={league.id} size="lg" />
          <h1 className="min-w-0 flex-1 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-balance sm:text-[2rem]">
            {league.name}
          </h1>
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * Shared frame for a league: banner, invite code, and the Events /
 * Leaderboard / Decks tabs. Non-members get the join form instead.
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

  if (!isMember)
    return (
      <div>
        <Banner league={league} />
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Enter the join code</h2>
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
              aria-label="Join code"
              className={`${codeInputClass} mb-3`}
              placeholder="ABC123"
            />
          </ActionForm>
        </Card>
      </div>
    );

  const users = await getUsers(league.memberIds);
  const members = league.memberIds.map((m) => ({
    name: users.get(m)?.name ?? "Unknown",
    image: users.get(m)?.image ?? null,
  }));

  return (
    <div>
      <Banner league={league}>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2">
            <AvatarStack people={members} max={6} />
            <span className="font-mono text-sm tabular-nums text-fg-dim">{members.length}</span>
          </span>
          <span className="flex-1" />
          {/* Kept together so a wrap never strands the refresh icon. */}
          <span className="flex items-center gap-1">
          <CopyButton
            text={league.joinCode}
            title="Copy invite code"
            className="!h-8 !rounded-full !px-3 !text-xs"
            label={
              <span className="flex items-center gap-1.5">
                <span className="text-fg-faint">Invite</span>
                <span className="font-mono tracking-[0.15em] text-accent">{league.joinCode}</span>
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-fg-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                  <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
                </svg>
              </span>
            }
            copiedLabel="✓ Code copied"
          />
          {isManager ? (
            <ActionForm
              action={rotateJoinCodeAction}
              fields={{ leagueId: league.id }}
              label={
                <>
                  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5" />
                  </svg>
                  <span className="sr-only">New invite code</span>
                </>
              }
              variant="ghost"
              size="sm"
            />
          ) : null}
          </span>
        </div>
        <div className="mt-5">
          <RouteTabs
            variant="segmented"
            base={`/leagues/${league.id}`}
            label="League"
            tabs={[
              { segment: null, label: "Events" },
              { segment: "players", label: "Leaderboard" },
              { segment: "decks", label: "Decks" },
            ]}
          />
        </div>
      </Banner>
      {props.children}
    </div>
  );
}
