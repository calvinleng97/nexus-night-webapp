import type { Round, UserId } from "@/lib/domain/types";
import { CardLink } from "./deck-view";

/**
 * Round-by-round bracket.
 *
 * Swiss is not a single-elimination tree — opponents are re-drawn from
 * standings each round, so there are no connector lines to draw between
 * columns. What reads as a bracket here is one column per round with the
 * matches as cards, which is how a store posts them on the wall.
 */
export function Bracket({
  rounds,
  nameOf,
  legendOf,
  viewerId,
}: {
  rounds: Round[];
  nameOf: (id: UserId | null) => string;
  /** Registered Legend for a player, or null if they did not register one. */
  legendOf: (id: UserId) => string | null;
  viewerId: UserId;
}) {
  return (
    <div className="scroll-x -mx-4 px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {rounds.map((round) => (
          <section key={round.number} className="w-[14.5rem] shrink-0">
            <header className="mb-2 flex items-baseline gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">
                Round {round.number}
              </h3>
              {round.closedAt === null ? (
                <span className="text-[0.7rem] text-accent">live</span>
              ) : null}
            </header>
            <ul className="space-y-2">
              {round.pairings.map((p) => {
                if (p.b === null)
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-dashed border-hair bg-surface/60 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${
                              p.a === viewerId ? "text-accent" : "text-fg-dim"
                            }`}
                          >
                            {nameOf(p.a)}
                          </span>
                          {legendOf(p.a) ? (
                            <CardLink
                              legend
                              name={legendOf(p.a)!}
                              className="block truncate text-[0.7rem] text-fg-faint"
                            />
                          ) : null}
                        </span>
                        <span className="text-[0.7rem] uppercase tracking-wide text-fg-faint">
                          bye
                        </span>
                      </div>
                    </li>
                  );

                const score = p.status === "confirmed" ? p.report?.score ?? null : null;
                const aWon = score ? score.a > score.b : false;
                const bWon = score ? score.b > score.a : false;
                const drawn = score ? score.a === score.b : false;

                const row = (id: UserId, games: number | null, won: boolean) => (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          won ? "font-medium text-fg" : "text-fg-dim"
                        } ${id === viewerId ? "text-accent" : ""}`}
                      >
                        {nameOf(id)}
                      </span>
                      {legendOf(id) ? (
                        <CardLink
                          legend
                          name={legendOf(id)!}
                          className="block truncate text-[0.7rem] text-fg-faint"
                        />
                      ) : null}
                    </span>
                    <span
                      className={`w-4 text-right font-mono text-sm tabular-nums ${
                        won ? "text-win" : drawn ? "text-draw" : "text-fg-faint"
                      }`}
                    >
                      {games ?? "·"}
                    </span>
                  </div>
                );

                return (
                  <li
                    key={p.id}
                    className={`rounded-xl border px-3 py-2.5 ${
                      score ? "border-hair bg-surface" : "border-hair-soft bg-surface/50"
                    }`}
                  >
                    <div className="space-y-1">
                      {row(p.a, score?.a ?? null, aWon)}
                      <div className="h-px bg-hair-soft" />
                      {row(p.b, score?.b ?? null, bWon)}
                    </div>
                    {p.status === "disputed" || p.kind === "forfeit" ? (
                      <p className="mt-1.5 text-[0.7rem] text-fg-faint">
                        {p.status === "disputed" ? "disputed" : "forfeit"}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
