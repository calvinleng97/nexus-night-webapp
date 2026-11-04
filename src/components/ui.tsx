import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Design notes
 * ------------
 * - One clear primary action per screen: a solid gold button. Everything else
 *   is secondary (bordered) or ghost.
 * - State is shown, not explained: pills, colour and swapped elements carry
 *   it. No helper sentences under headings.
 * - Section headings are ordinary words at reading size. Tiny all-caps labels
 *   are reserved for table headers.
 */

// ------------------------------------------------------------------ buttons

const BTN_VARIANTS = {
  /** The strongest call to action on a page: filled, dark text on gold. */
  solid: "border-accent bg-accent text-ink hover:bg-accent/90",
  /** Gold-tinted, for a positive action that is not the main one. */
  primary: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
  default: "border-hair bg-raised text-fg hover:border-fg-faint/40 hover:bg-hover",
  danger: "border-loss/40 bg-loss/10 text-loss hover:bg-loss/20",
  /** The filled counterpart of `solid`, for undoing it. */
  solidDanger: "border-loss bg-loss text-ink hover:bg-loss/90",
  ghost: "border-transparent text-fg-dim hover:bg-raised hover:text-fg",
} as const;

const BTN_SIZES = {
  sm: "h-8 px-3 text-[0.8rem] rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-[0.95rem] font-semibold rounded-xl",
} as const;

export type ButtonVariant = keyof typeof BTN_VARIANTS;
export type ButtonSize = keyof typeof BTN_SIZES;

export function btn(variant: ButtonVariant = "default", size: ButtonSize = "md", full = false) {
  return `inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45 ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${full ? "w-full" : ""}`;
}

export function LinkButton({
  href,
  children,
  variant = "default",
  size = "md",
  full = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} role="button" className={`${btn(variant, size, full)} ${className}`}>
      {children}
    </Link>
  );
}

// ------------------------------------------------------------------ surfaces

const CARD_TONES = {
  plain: "border-hair-soft bg-surface",
  raised: "border-hair bg-raised",
  accent: "border-accent/35 bg-gradient-to-b from-accent-soft/45 to-surface",
  win: "border-win/30 bg-win/[0.06]",
  loss: "border-loss/30 bg-loss/[0.06]",
  warn: "border-draw/30 bg-draw/[0.06]",
} as const;

export type CardTone = keyof typeof CARD_TONES;

/** A rounded surface. `tone` distinguishes kinds of content at a glance. */
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
  tone?: CardTone;
  interactive?: boolean;
}) {
  return (
    <As
      className={`rounded-2xl border ${CARD_TONES[tone]} ${
        interactive ? "transition-colors hover:border-fg-faint/35" : ""
      } ${className}`}
    >
      {children}
    </As>
  );
}

/** A titled block of a page, with room for one action on the right. */
export function Section({
  title,
  count,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-10 first:mt-0 ${className}`}>
      <div className="mb-3 flex min-h-8 items-center gap-3">
        <h2 className="min-w-0 flex-1 text-[1.05rem] font-semibold tracking-tight">
          {title}
          {count !== undefined ? (
            <span className="ml-2 font-mono text-sm font-normal tabular-nums text-fg-faint">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group -ml-1.5 inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-fg-dim transition-colors hover:text-fg"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      <span className="truncate">{children}</span>
    </Link>
  );
}

/**
 * The top of a page: an optional back link, the title, a row of state pills
 * and an action on the right. No muted metadata line — that's what the pills
 * are for.
 */
export function PageHeader({
  back,
  title,
  pills,
  action,
}: {
  back?: { href: string; label: string };
  title: ReactNode;
  pills?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      <div className={`flex items-start gap-3 ${back ? "mt-2" : ""}`}>
        <h1 className="min-w-0 flex-1 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-balance sm:text-[2rem]">
          {title}
        </h1>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
      {pills ? <div className="mt-3 flex flex-wrap items-center gap-2">{pills}</div> : null}
    </header>
  );
}

// --------------------------------------------------------------------- pills

const PILL_TONES = {
  neutral: "border-hair bg-raised text-fg-dim",
  accent: "border-accent/35 bg-accent/10 text-accent",
  win: "border-win/30 bg-win/10 text-win",
  loss: "border-loss/30 bg-loss/10 text-loss",
  draw: "border-draw/30 bg-draw/10 text-draw",
} as const;

export type PillTone = keyof typeof PILL_TONES;

/** The one chip shape: a state, a count, or a small fact. */
export function Pill({
  children,
  tone = "neutral",
  dot = false,
  pulse = false,
  size = "md",
}: {
  children: ReactNode;
  tone?: PillTone;
  /** A leading status dot in the pill's colour. */
  dot?: boolean;
  /** Animate the dot, for things happening right now. */
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        size === "sm" ? "px-2 py-px text-[0.7rem] leading-5" : "px-2.5 py-0.5 text-xs leading-5"
      } ${PILL_TONES[tone]}`}
    >
      {dot || pulse ? (
        <span
          aria-hidden
          className={`size-1.5 rounded-full bg-current ${pulse ? "animate-pulse-dot" : ""}`}
        />
      ) : null}
      {children}
    </span>
  );
}

/** A figure and its unit as one chip: "8 players". */
export function CountPill({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: PillTone;
}) {
  return (
    <Pill tone={tone}>
      <span className="font-mono tabular-nums text-fg">{value}</span>
      {label}
    </Pill>
  );
}

/** An event's lifecycle as a pill. Live pulses. */
export function StatusPill({
  status,
  round,
  totalRounds,
}: {
  status: "draft" | "running" | "complete" | "cancelled";
  round?: number;
  totalRounds?: number;
}) {
  if (status === "running")
    return (
      <Pill tone="win" pulse>
        Live{round ? ` · Round ${round}${totalRounds ? `/${totalRounds}` : ""}` : ""}
      </Pill>
    );
  if (status === "draft") return <Pill tone="accent">Sign-ups open</Pill>;
  if (status === "complete") return <Pill>Final</Pill>;
  return <Pill tone="loss">Cancelled</Pill>;
}

// ------------------------------------------------------------------- avatars

export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_SIZES = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-[0.7rem]",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
} as const;

/** A player's face, or their initials on a colour derived from their name. */
export function Avatar({
  name,
  image = null,
  size = "sm",
  ring = false,
}: {
  name: string;
  image?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  ring?: boolean;
}) {
  const cls = `${AVATAR_SIZES[size]} shrink-0 rounded-full ${ring ? "ring-2 ring-ink" : ""}`;
  if (image)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" referrerPolicy="no-referrer" className={`${cls} object-cover`} />
    );
  const hue = hueOf(name);
  return (
    <span
      aria-hidden
      className={`${cls} inline-flex items-center justify-center font-semibold`}
      style={{ background: `oklch(0.34 0.07 ${hue})`, color: `oklch(0.9 0.06 ${hue})` }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping faces for "who's coming", capped with a +N. */
export function AvatarStack({
  people,
  max = 5,
}: {
  people: Array<{ name: string; image?: string | null }>;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} image={p.image} size="xs" ring />
      ))}
      {extra > 0 ? (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-raised font-mono text-[0.6rem] text-fg-dim ring-2 ring-ink">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

// -------------------------------------------------------------------- misc

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hair px-5 py-10 text-center">
      <p className="text-sm text-fg-dim">{children}</p>
      {action}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg-dim">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-hair bg-ink px-3.5 py-2.5 text-base text-fg outline-none transition-colors placeholder:text-fg-faint/70 focus:border-accent/60";

export const codeInputClass =
  "w-full rounded-xl border border-hair bg-ink px-3.5 py-2.5 font-mono text-lg uppercase tracking-[0.25em] text-fg outline-none transition-colors placeholder:tracking-[0.25em] placeholder:text-fg-faint/50 focus:border-accent/60";

/** Monospace score, so columns of results line up. */
export function Score({
  mine,
  theirs,
  className = "text-sm",
}: {
  mine: number;
  theirs: number;
  className?: string;
}) {
  const tone = mine > theirs ? "text-win" : mine < theirs ? "text-loss" : "text-draw";
  return (
    <span className={`font-mono font-semibold tabular-nums ${tone} ${className}`}>
      {mine}–{theirs}
    </span>
  );
}

/** One headline figure as a tile. */
export function Stat({
  label,
  value,
  tone,
  footer,
}: {
  label: string;
  value: string;
  tone?: "win" | "accent";
  /** Something drawn under the label, e.g. a WinRate meter. */
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hair-soft bg-surface px-4 py-3.5">
      <div
        className={`font-mono text-xl font-semibold leading-none tabular-nums ${
          tone === "win" ? "text-win" : tone === "accent" ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-fg-faint">{label}</div>
      {footer}
    </div>
  );
}

/** Right-pointing chevron for rows that open something. */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 text-fg-faint ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

/** Table header cell text. The one place tiny caps stay. */
export const thClass = "py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider text-fg-faint";

/** Small caps label, for the sections of a decklist. */
export function MicroLabel({ children }: { children: ReactNode }) {
  return <p className={thClass.replace("py-2.5 ", "")}>{children}</p>;
}

// -------------------------------------------------------------- league crest

const CREST_SIZES = { xs: "h-5 w-[1.1rem] text-[0.5rem]", sm: "h-9 w-8 text-xs", lg: "h-[4.5rem] w-16 text-2xl" } as const;

/**
 * A league's identity mark: a shield with its initials. Leagues are always
 * shown with one, events always with a date stub, so the two never read as
 * the same kind of thing.
 */
export function Crest({
  name,
  seed,
  size = "sm",
}: {
  name: string;
  /** Stable colour key — the league id. */
  seed: string;
  size?: keyof typeof CREST_SIZES;
}) {
  const hue = hueOf(seed);
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 ${CREST_SIZES[size]}`}>
      <svg viewBox="0 0 40 46" className="absolute inset-0 size-full">
        <path
          d="M20 1.5 37.5 7v15c0 11.5-7.6 18.6-17.5 22.5C10.1 40.6 2.5 33.5 2.5 22V7z"
          fill={`oklch(0.3 0.08 ${hue})`}
          stroke={`oklch(0.62 0.12 ${hue})`}
          strokeWidth="2"
        />
      </svg>
      <span
        className="relative flex size-full items-center justify-center pb-[12%] font-bold tracking-tight"
        style={{ color: `oklch(0.92 0.07 ${hue})` }}
      >
        {initials(name)}
      </span>
    </span>
  );
}

// ----------------------------------------------------------------- win rate

/**
 * A win rate as a meter: the figure, its unit ("win"), and a thin bar whose
 * length you read before the digits. A tick marks 50% — the line between a
 * winning and a losing deck — and the fill is green above it, red below.
 * The number stays in text ink; the bar carries the colour.
 */
export function WinRate({
  rate,
  size = "row",
  className = "",
}: {
  /** 0–1, or null before any rounds were played. */
  rate: number | null;
  /** `row` for list rows and tables, `tile` under a Stat. */
  size?: "row" | "tile";
  className?: string;
}) {
  const pctText = rate === null ? "—" : `${Math.round(rate * 100)}%`;
  const fill = rate === null ? "" : rate >= 0.5 ? "bg-win" : "bg-loss";
  const track = rate === null ? "bg-hair" : rate >= 0.5 ? "bg-win/15" : "bg-loss/15";
  const bar = (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-full ${track} ${size === "tile" ? "mt-2.5 h-1.5" : "mt-1.5 h-1"}`}
    >
      {rate !== null ? (
        <span className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${Math.max(rate * 100, 3)}%` }} />
      ) : null}
      <span className="absolute inset-y-0 left-1/2 w-px bg-ink/80" />
    </span>
  );

  if (size === "tile")
    return (
      <span
        role="img"
        aria-label={rate === null ? "No rounds played" : `${pctText} win rate`}
        className={`block ${className}`}
      >
        {bar}
      </span>
    );

  return (
    <span
      className={`block w-[4.5rem] shrink-0 ${className}`}
      aria-label={rate === null ? "No rounds played" : `${pctText} win rate`}
    >
      <span className="flex items-baseline justify-end gap-1">
        <span className={`font-mono text-[0.95rem] font-bold tabular-nums ${rate === null ? "text-fg-faint" : "text-fg"}`}>
          {pctText}
        </span>
        <span className="text-[0.7rem] font-medium text-fg-faint">win</span>
      </span>
      {bar}
    </span>
  );
}
