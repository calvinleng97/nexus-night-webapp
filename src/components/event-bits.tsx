import Link from "next/link";
import type { ReactNode } from "react";
import { eventDateParts, formatDay } from "@/lib/domain/schedule";
import { shortLegend } from "@/lib/domain/deck";
import { recordLabel } from "@/lib/domain/standings";
import type { NexusEvent, Pairing, Standing, UserId } from "@/lib/domain/types";
import { CardLink } from "./deck-view";
import { Avatar, AvatarStack, Card, Chevron, Crest, Pill, StatusPill, thClass } from "./ui";

export type Person = { name: string; image: string | null };
export type WhoFn = (id: UserId) => Person;

/** Calendar-style date: the first thing to read on an event. */
export function DateTile({ value, live = false }: { value: string | null; live?: boolean }) {
  const when = eventDateParts(value);
  return (
    <div
      className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2 ${
        live ? "border-accent/35 bg-ink/50" : "border-hair bg-raised"
      }`}
    >
      {when ? (
        <>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-faint">
            {when.weekday}
          </span>
          <span
            className={`font-mono text-[1.4rem] font-semibold leading-tight tabular-nums ${
              live ? "text-accent" : "text-fg"
            }`}
          >
            {when.day}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-faint">
            {when.month}
          </span>
        </>
      ) : (
        <span className="py-2.5 text-xs font-semibold text-fg-faint">TBD</span>
      )}
    </div>
  );
}

/** "19:00", when the event has a time. */
export function timeOf(value: string | null): string | null {
  return eventDateParts(value)?.time ?? null;
}

/**
 * An upcoming or live event as a card: date, name, who's coming, and one
 * trailing slot for the viewer's state or action.
 */
export function EventCard({
  event,
  href,
  who,
  subtitle,
  trailing,
}: {
  event: NexusEvent;
  href: string;
  who: WhoFn;
  /** e.g. the league name on the home page. */
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  const live = event.status === "running";
  const time = timeOf(event.scheduledFor);
  const going = event.players.map((p) => who(p.userId));
  return (
    <Card as="li" interactive tone={live ? "accent" : "plain"} className="relative">
      <div className="flex items-center gap-4 p-4">
        <DateTile value={event.scheduledFor} live={live} />
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[1.05rem] font-semibold after:absolute after:inset-0 after:rounded-2xl">
            {event.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-fg-dim">
            {live ? (
              <StatusPill status="running" round={event.rounds.length} totalRounds={event.totalRounds} />
            ) : null}
            {time ? <span className="font-mono tabular-nums">{time}</span> : null}
            {subtitle ? <span className="truncate">{subtitle}</span> : null}
          </div>
          {going.length > 0 ? (
            <div className="mt-2.5 flex items-center gap-2">
              <AvatarStack people={going} />
              <span className="font-mono text-xs tabular-nums text-fg-faint">{going.length}</span>
            </div>
          ) : null}
        </div>
        {/* Above the stretched link, so its buttons stay clickable. */}
        {trailing ? <div className="relative z-10 shrink-0">{trailing}</div> : <Chevron />}
      </div>
    </Card>
  );
}

/** A past event as one compact row. */
export function PastEventRow({
  event,
  href,
  mine,
}: {
  event: NexusEvent;
  href: string;
  /** The viewer's record there, if they played. */
  mine: string | null;
}) {
  // Undated events fall back to the day they were played.
  const when = eventDateParts(event.scheduledFor);
  const day = when
    ? `${when.day} ${when.month}`
    : (formatDay(event.startedAt ?? event.createdAt)?.replace(/ \d{4}$/, "") ?? "—");
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised"
      >
        <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-fg-faint">
          {day}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.95rem]">{event.name}</span>
        {mine ? <span className="font-mono text-sm tabular-nums text-fg-dim">{mine}</span> : null}
        <Chevron />
      </Link>
    </li>
  );
}

/** One side of a match row. */
function Side({
  id,
  who,
  legend,
  me,
  won,
  align,
}: {
  id: UserId;
  who: WhoFn;
  legend: string | null;
  me: boolean;
  won: boolean;
  align: "left" | "right";
}) {
  const p = who(id);
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <Avatar name={p.name} image={p.image} size="sm" />
      <span className="min-w-0">
        <span
          className={`block truncate text-sm ${me ? "font-semibold text-accent" : won ? "font-semibold text-fg" : "text-fg-dim"}`}
        >
          {p.name}
        </span>
        {legend ? (
          <span className="block truncate text-xs text-fg-faint">{shortLegend(legend) ?? legend}</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * A pairing as a full-width row: player · score · player. The middle says
 * where the match is at when there is no score yet.
 */
export function MatchRow({
  pairing,
  who,
  legendOf,
  viewerId,
}: {
  pairing: Pairing;
  who: WhoFn;
  legendOf: (id: UserId) => string | null;
  viewerId: UserId;
}) {
  const mine = pairing.a === viewerId || pairing.b === viewerId;
  if (pairing.b === null)
    return (
      <li className={`flex items-center gap-3 px-4 py-3 ${mine ? "bg-accent/[0.06]" : ""}`}>
        <Side
          id={pairing.a}
          who={who}
          legend={legendOf(pairing.a)}
          me={pairing.a === viewerId}
          won={false}
          align="left"
        />
        <Pill size="sm">Bye</Pill>
      </li>
    );

  const score = pairing.status === "confirmed" ? (pairing.report?.score ?? null) : null;
  const aWon = !!score && score.a > score.b;
  const bWon = !!score && score.b > score.a;

  let middle: ReactNode;
  if (score)
    middle = (
      <span className="font-mono text-base font-semibold tabular-nums">
        <span className={aWon ? "text-win" : "text-fg-faint"}>{score.a}</span>
        <span className="px-1 text-fg-faint">–</span>
        <span className={bWon ? "text-win" : "text-fg-faint"}>{score.b}</span>
      </span>
    );
  else if (pairing.status === "disputed")
    middle = (
      <Pill size="sm" tone="loss">
        Disputed
      </Pill>
    );
  else if (pairing.status === "awaiting_confirmation")
    middle = (
      <Pill size="sm" tone="draw">
        Reported
      </Pill>
    );
  else middle = <span className="text-xs font-medium text-fg-faint">vs</span>;

  return (
    <li className={`flex items-center gap-2 px-4 py-3 ${mine ? "bg-accent/[0.06]" : ""}`}>
      <Side
        id={pairing.a}
        who={who}
        legend={legendOf(pairing.a)}
        me={pairing.a === viewerId}
        won={aWon}
        align="left"
      />
      <span className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1">
        {middle}
        {pairing.rematch || pairing.kind === "forfeit" ? (
          <Pill size="sm" tone={pairing.kind === "forfeit" ? "loss" : "draw"}>
            {pairing.kind === "forfeit" ? "Forfeit" : "Rematch"}
          </Pill>
        ) : null}
      </span>
      <Side
        id={pairing.b}
        who={who}
        legend={legendOf(pairing.b)}
        me={pairing.b === viewerId}
        won={bWon}
        align="right"
      />
    </li>
  );
}

export function MatchList({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-hair-soft">{children}</ul>
    </Card>
  );
}

/** Rank · player · record. Equal records share a rank; nobody is crowned. */
export function StandingsTable({
  standings,
  who,
  legendOf,
  viewerId,
}: {
  standings: Standing[];
  who: WhoFn;
  legendOf: (id: UserId) => string | null;
  viewerId: UserId;
}) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hair-soft text-left">
            <th className={`${thClass} w-12 pl-4 pr-1`}>#</th>
            <th className={`${thClass} pr-2`}>Player</th>
            <th className={`${thClass} pr-4 text-right`}>W-L-D</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const me = s.userId === viewerId;
            const p = who(s.userId);
            const legend = legendOf(s.userId);
            return (
              <tr
                key={s.userId}
                className={`border-b border-hair-soft last:border-0 ${me ? "bg-accent/[0.06]" : ""}`}
              >
                <td className="py-2.5 pl-4 pr-1 font-mono tabular-nums text-fg-faint">{s.rank}</td>
                <td className="py-2.5 pr-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={p.name} image={p.image} size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`truncate ${me ? "font-semibold text-accent" : ""} ${s.dropped ? "text-fg-faint line-through" : ""}`}
                        >
                          {p.name}
                        </span>
                        {s.byes > 0 ? <Pill size="sm">bye</Pill> : null}
                      </span>
                      {legend ? (
                        <CardLink legend name={legend} className="block truncate text-xs text-fg-faint" />
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-fg">
                  {recordLabel(s)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

const TICKET_TONE = {
  running: { frame: "border-win/35", stub: "bg-win/10 text-win", glow: "shadow-[0_0_40px_-12px] shadow-win/40" },
  draft: { frame: "border-accent/35", stub: "bg-accent/10 text-accent", glow: "" },
  complete: { frame: "border-hair", stub: "bg-raised text-fg-dim", glow: "" },
  cancelled: { frame: "border-loss/30", stub: "bg-loss/10 text-loss", glow: "" },
} as const;

/**
 * An event's header, shaped like a ticket: a date stub, a perforation, and
 * the event itself. The parent league sits above it as a crest breadcrumb.
 * Leagues get a banner instead, so the two page types never look alike.
 */
export function EventTicket({
  event,
  league,
  pills,
}: {
  event: NexusEvent;
  league: { id: string; name: string } | null;
  pills: ReactNode;
}) {
  const when = eventDateParts(event.scheduledFor);
  const tone = TICKET_TONE[event.status];
  return (
    <header className="mb-6">
      <Link
        href={league ? `/leagues/${league.id}` : "/leagues"}
        className="group -ml-1.5 inline-flex max-w-full items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-fg-dim transition-colors hover:text-fg"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
        {league ? <Crest name={league.name} seed={league.id} size="xs" /> : null}
        <span className="truncate">{league?.name ?? "Home"}</span>
      </Link>

      <div className={`relative mt-3 flex rounded-2xl border bg-surface ${tone.frame} ${tone.glow}`}>
        {/* The stub: the date is the first thing to read on an event. */}
        <div className={`flex w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-l-2xl py-4 sm:w-24 ${tone.stub}`}>
          {when ? (
            <>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider opacity-80">
                {when.weekday}
              </span>
              <span className="font-mono text-[2rem] font-bold leading-none tabular-nums">{when.day}</span>
              <span className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-wider opacity-80">
                {when.month}
              </span>
              <span className="mt-2 font-mono text-xs tabular-nums text-fg-dim">{when.time}</span>
            </>
          ) : (
            <span className="text-sm font-semibold">TBD</span>
          )}
        </div>
        {/* Perforation, with a notch punched at each end. */}
        <div aria-hidden className="relative w-0 border-l-2 border-dashed border-hair">
          <span className={`absolute -top-px left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-b-full border border-t-0 bg-ink ${tone.frame}`} />
          <span className={`absolute -bottom-px left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-t-full border border-b-0 bg-ink ${tone.frame}`} />
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <h1 className="text-[1.5rem] font-bold leading-tight tracking-[-0.02em] text-balance sm:text-[1.85rem]">
            {event.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">{pills}</div>
        </div>
      </div>
    </header>
  );
}
