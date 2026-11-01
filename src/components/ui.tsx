import Link from "next/link";
import type { ReactNode } from "react";

/** A bordered surface. `tone` distinguishes kinds of content at a glance. */
export function Card({
  children,
  className = "",
  as: As = "div",
  tone = "plain",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "section";
  tone?: "plain" | "raised" | "accent" | "win";
  interactive?: boolean;
}) {
  const tones = {
    plain: "border-hair bg-surface",
    raised: "border-hair-soft bg-raised",
    accent: "border-accent/30 bg-accent-soft/30",
    win: "border-win/25 bg-win/5",
  } as const;
  return (
    <As
      className={`rounded-2xl border ${tones[tone]} ${
        interactive ? "transition-colors hover:border-accent/40" : ""
      } ${className}`}
    >
      {children}
    </As>
  );
}

/** Small all-caps section label, with room for one action on the right. */
export function SectionHead({
  children,
  action,
  count,
}: {
  children: ReactNode;
  action?: ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">
        {children}
        {count !== undefined ? <span className="ml-1.5 text-fg-faint/70">{count}</span> : null}
      </h2>
      <div className="h-px flex-1 bg-hair-soft" />
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-fg-dim transition-colors hover:text-fg"
    >
      <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
        ←
      </span>
      {children}
    </Link>
  );
}

/**
 * Page heading. Intentionally has no metadata slot — counts and states belong
 * in CountPill/Tag chips, not in a muted line under the title.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-6 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-3xl">
      {children}
    </h1>
  );
}

const TONES = {
  neutral: "border-hair bg-raised text-fg-dim",
  accent: "border-accent/35 bg-accent/10 text-accent",
  win: "border-win/30 bg-win/10 text-win",
  loss: "border-loss/30 bg-loss/10 text-loss",
  draw: "border-draw/30 bg-draw/10 text-draw",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium leading-5 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-fg-faint">{children}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-hair bg-ink px-3.5 py-2.5 text-base text-fg outline-none placeholder:text-fg-faint/70 focus:border-accent/50";

/** Monospace score, so columns of results line up. */
export function Score({ mine, theirs }: { mine: number; theirs: number }) {
  const tone = mine > theirs ? "text-win" : mine < theirs ? "text-loss" : "text-draw";
  return (
    <span className={`font-mono text-sm tabular-nums ${tone}`}>
      {mine}–{theirs}
    </span>
  );
}

const PILL_TONES = {
  plain: "border-hair bg-raised",
  accent: "border-accent/35 bg-accent/10",
  warn: "border-draw/35 bg-draw/10",
} as const;

/**
 * A figure with its unit, as one deliberate chip.
 *
 * This exists so counts never appear as a muted sentence under a heading —
 * "1 event · 8 players" reads as throwaway metadata, whereas a chip reads as
 * information the page means to show you.
 */
export function CountPill({
  value,
  label,
  tone = "plain",
}: {
  value: number | string;
  label: string;
  tone?: keyof typeof PILL_TONES;
}) {
  const valueTone = tone === "accent" ? "text-accent" : tone === "warn" ? "text-draw" : "text-fg";
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1 ${PILL_TONES[tone]}`}
    >
      <span className={`font-mono text-sm font-medium tabular-nums ${valueTone}`}>{value}</span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-faint">
        {label}
      </span>
    </span>
  );
}

/** A standalone stylized label, for states that have no number attached. */
export function Tag({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  const textTone = tone === "accent" ? "text-accent" : tone === "warn" ? "text-draw" : "text-fg-dim";
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider ${PILL_TONES[tone]} ${textTone}`}
    >
      {children}
    </span>
  );
}

/** Small all-caps label that reads as design, not as muted metadata. */
export function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fg-faint">
      {children}
    </p>
  );
}
