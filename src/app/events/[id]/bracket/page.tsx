import { roundProgress } from "@/lib/domain/my-match";
import { MatchList, MatchRow } from "@/components/event-bits";
import { Empty, Pill, Section } from "@/components/ui";
import { loadEventView } from "../load";

/**
 * The Rounds tab: every round's pairings, newest first.
 *
 * Swiss is not an elimination tree — opponents are re-drawn from standings
 * each round — so this is a list per round rather than a bracket with
 * connector lines.
 */
export default async function EventRoundsPage(props: PageProps<"/events/[id]/bracket">) {
  const { id } = await props.params;
  const { userId, event, who, legendOf } = await loadEventView(id);

  if (event.rounds.length === 0) return <Empty>No pairings yet.</Empty>;

  return (
    <div>
      {[...event.rounds].reverse().map((round) => {
        const live = round.closedAt === null && event.status === "running";
        const { done, total } = roundProgress(round);
        return (
          <Section
            key={round.number}
            title={`Round ${round.number}`}
            action={
              live ? (
                <Pill tone="win" pulse>
                  <span className="font-mono tabular-nums">
                    {done}/{total}
                  </span>
                  in
                </Pill>
              ) : null
            }
          >
            <MatchList>
              {round.pairings.map((p) => (
                <MatchRow key={p.id} pairing={p} who={who} legendOf={legendOf} viewerId={userId} />
              ))}
            </MatchList>
          </Section>
        );
      })}
    </div>
  );
}
