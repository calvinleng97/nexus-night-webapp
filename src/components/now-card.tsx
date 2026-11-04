import Link from "next/link";
import { currentRound } from "@/lib/domain/event-machine";
import { myMatch, roundProgress } from "@/lib/domain/my-match";
import type { NexusEvent, UserId } from "@/lib/domain/types";
import type { WhoFn } from "./event-bits";
import { Avatar, Card, Pill, Score, StatusPill, btn } from "./ui";

/**
 * A live event you're playing in, reduced to the one thing you need to do in
 * it right now. Lives on the home page, so opening the app mid-night lands
 * you one tap from your result.
 */
export function NowCard({
  event,
  userId,
  who,
}: {
  event: NexusEvent;
  userId: UserId;
  who: WhoFn;
}) {
  const href = `/events/${event.id}`;
  const m = myMatch(event, userId);
  const round = currentRound(event);
  const progress = round ? roundProgress(round) : null;
  const opp = m && m.kind !== "bye" ? who(m.opponent) : null;

  let state = null;
  let cta = null;
  switch (m?.kind) {
    case "report":
      cta = "Report result";
      break;
    case "confirm":
      state = (
        <Pill tone="draw" dot>
          Confirm <Score {...m.score} className="text-xs" />
        </Pill>
      );
      cta = "Review result";
      break;
    case "waiting":
      state = (
        <Pill tone="neutral" pulse>
          Waiting on {opp?.name}
        </Pill>
      );
      break;
    case "disputed":
      state = <Pill tone="loss">Disputed</Pill>;
      break;
    case "done":
      state = (
        <>
          {m.score ? (
            <Pill tone={m.score.mine > m.score.theirs ? "win" : m.score.mine < m.score.theirs ? "loss" : "draw"}>
              {m.score.mine > m.score.theirs ? "Won" : m.score.mine < m.score.theirs ? "Lost" : "Drew"}{" "}
              <span className="font-mono tabular-nums">
                {m.score.mine}–{m.score.theirs}
              </span>
            </Pill>
          ) : null}
          {progress ? (
            <Pill>
              <span className="font-mono tabular-nums text-fg">
                {progress.done}/{progress.total}
              </span>
              matches in
            </Pill>
          ) : null}
        </>
      );
      break;
    case "bye":
      state = <Pill tone="accent">Bye this round</Pill>;
      break;
    default:
      state = <Pill>Spectating</Pill>;
  }

  return (
    <Card as="li" tone="accent" className="relative p-5">
      <div className="flex items-center gap-2">
        <Link
          href={href}
          className="min-w-0 flex-1 truncate font-semibold after:absolute after:inset-0 after:rounded-2xl"
        >
          {event.name}
        </Link>
        <StatusPill status="running" round={event.rounds.length} totalRounds={event.totalRounds} />
      </div>

      {opp ? (
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={opp.name} image={opp.image} size="md" />
          <div className="min-w-0">
            <p className="text-xs text-fg-faint">vs</p>
            <p className="truncate text-xl font-bold leading-tight tracking-tight">{opp.name}</p>
          </div>
        </div>
      ) : null}

      {state ? <div className="mt-4 flex flex-wrap items-center gap-2">{state}</div> : null}
      {cta ? (
        <span className={`${btn("solid", "lg", true)} pointer-events-none mt-4`}>{cta} →</span>
      ) : null}
    </Card>
  );
}
