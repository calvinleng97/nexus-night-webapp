/** Best-of-three options, phrased from the submitting player's perspective. */
export const SCORE_OPTIONS = [
  { value: "2-0", label: "I won 2-0" },
  { value: "2-1", label: "I won 2-1" },
  { value: "1-2", label: "I lost 1-2" },
  { value: "0-2", label: "I lost 0-2" },
  { value: "1-1", label: "Draw 1-1 (time)" },
] as const;

export function ScoreSelect({ name = "score" }: { name?: string }) {
  return (
    <select
      name={name}
      required
      defaultValue=""
      className="mb-3 w-full rounded-xl border border-hair bg-base px-3.5 py-2.5 text-base outline-none focus:border-accent/50"
    >
      <option value="" disabled>
        Pick your result…
      </option>
      {SCORE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Manager variant: explicit player names rather than "I". */
export function ManagerScoreSelect({ aName, bName }: { aName: string; bName: string }) {
  const options = [
    { value: "2-0", label: `${aName} 2-0` },
    { value: "2-1", label: `${aName} 2-1` },
    { value: "1-1", label: "Draw 1-1" },
    { value: "1-2", label: `${bName} 2-1` },
    { value: "0-2", label: `${bName} 2-0` },
  ];
  return (
    <select
      name="score"
      required
      defaultValue=""
      className="mb-2 w-full rounded-xl border border-hair bg-base px-3 py-2 text-sm outline-none focus:border-accent/50"
    >
      <option value="" disabled>
        Set result…
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
