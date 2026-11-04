"use client";

import { useActionState, useState } from "react";
import { EMPTY_STATE } from "@/app/action-state";
import { ActionMessages, type Action } from "./action-form";
import { btn } from "./ui";

type Opt = { value: string; label: string; tone: "win" | "loss" | "draw" };

/** Best-of-three results from the reporting player's side. */
const WIN: Opt[] = [
  { value: "2-0", label: "2–0", tone: "win" },
  { value: "2-1", label: "2–1", tone: "win" },
];
const LOSS: Opt[] = [
  { value: "1-2", label: "1–2", tone: "loss" },
  { value: "0-2", label: "0–2", tone: "loss" },
];
/** Rounds that ran out of time. */
const TIME: Opt[] = [
  { value: "1-0", label: "1–0", tone: "win" },
  { value: "1-1", label: "1–1", tone: "draw" },
  { value: "0-1", label: "0–1", tone: "loss" },
];

const ON = {
  win: "border-win bg-win/15 text-win",
  loss: "border-loss bg-loss/15 text-loss",
  draw: "border-draw bg-draw/15 text-draw",
} as const;

function Choice({
  opt,
  picked,
  onPick,
  small = false,
}: {
  opt: Opt;
  picked: boolean;
  onPick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={`rounded-xl border font-mono font-semibold tabular-nums transition-colors ${
        small ? "h-10 text-sm" : "h-14 text-xl"
      } ${picked ? ON[opt.tone] : "border-hair bg-ink text-fg hover:border-fg-faint/50"}`}
    >
      {opt.label}
    </button>
  );
}

function verdict(v: string): string {
  const [m, t] = v.split("-").map(Number) as [number, number];
  return m > t ? `Won ${m}–${t}` : m < t ? `Lost ${m}–${t}` : `Draw ${m}–${t}`;
}

/**
 * The player's result entry: tap a score, then submit. Two taps on purpose —
 * the first one is easy to get wrong on a crowded table.
 */
export function ScorePad({
  action,
  eventId,
  pairingId,
}: {
  action: Action;
  eventId: string;
  pairingId: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);
  const [score, setScore] = useState<string | null>(null);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="pairingId" value={pairingId} />
      <input type="hidden" name="score" value={score ?? ""} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-win">I won</p>
          <div className="grid grid-cols-2 gap-2">
            {WIN.map((o) => (
              <Choice key={o.value} opt={o} picked={score === o.value} onPick={() => setScore(o.value)} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-loss">I lost</p>
          <div className="grid grid-cols-2 gap-2">
            {LOSS.map((o) => (
              <Choice key={o.value} opt={o} picked={score === o.value} onPick={() => setScore(o.value)} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <p className="w-11 shrink-0 text-sm font-medium text-fg-dim">Time</p>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {TIME.map((o) => (
            <Choice key={o.value} opt={o} small picked={score === o.value} onPick={() => setScore(o.value)} />
          ))}
        </div>
      </div>

      <button type="submit" disabled={!score || pending} className={`${btn("solid", "lg", true)} mt-5`}>
        {pending ? "Sending…" : score ? `Submit · ${verdict(score)}` : "Pick a score"}
      </button>
      <ActionMessages state={state} />
    </form>
  );
}

/**
 * Manager entry for someone else's match: how many games each player won,
 * 0–2 apiece. 2–2 can't happen in a best-of-three, so once one side has 2 the
 * other side's 2 is off. Submitted from player A's side, which is how the
 * server reads a manager's result.
 */
export function ManagerScorePad({
  action,
  eventId,
  pairingId,
  aName,
  bName,
}: {
  action: Action;
  eventId: string;
  pairingId: string;
  aName: string;
  bName: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const ready = a !== null && b !== null;

  const label = () => {
    if (!ready) return "Pick both scores";
    if (a === b) return `Set · Draw ${a}–${b}`;
    return a > b ? `Set · ${aName} ${a}–${b}` : `Set · ${bName} ${b}–${a}`;
  };

  const row = (name: string, value: number | null, set: (n: number) => void, other: number | null) => (
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1 truncate text-sm">{name}</p>
      <div className="grid w-44 shrink-0 grid-cols-3 gap-1.5" role="radiogroup" aria-label={`${name} games won`}>
        {[0, 1, 2].map((n) => {
          const picked = value === n;
          const tone = !ready || !picked ? null : value! > other! ? "win" : value! < other! ? "loss" : "draw";
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={n === 2 && other === 2}
              onClick={() => set(n)}
              className={`h-10 rounded-xl border font-mono text-base font-semibold tabular-nums transition-colors disabled:opacity-25 ${
                picked
                  ? tone
                    ? ON[tone]
                    : "border-accent bg-accent/15 text-accent"
                  : "border-hair bg-ink text-fg hover:border-fg-faint/50"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="pairingId" value={pairingId} />
      <input type="hidden" name="score" value={ready ? `${a}-${b}` : ""} />
      <div className="space-y-2">
        {row(aName, a, setA, b)}
        {row(bName, b, setB, a)}
      </div>
      <button type="submit" disabled={!ready || pending} className={`${btn("primary", "md", true)} mt-3`}>
        {pending ? "Saving…" : label()}
      </button>
      <ActionMessages state={state} />
    </form>
  );
}
