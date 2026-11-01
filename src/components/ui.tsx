import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "li";
}) {
  return (
    <As
      className={`rounded-xl border border-line bg-panel/80 p-4 sm:p-5 ${className}`}
    >
      {children}
    </As>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </header>
  );
}

const TONES = {
  neutral: "border-line bg-panel-2 text-muted",
  accent: "border-accent-dim/60 bg-accent/10 text-accent",
  win: "border-win/40 bg-win/10 text-win",
  loss: "border-loss/40 bg-loss/10 text-loss",
  draw: "border-draw/40 bg-draw/10 text-draw",
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
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-ink px-3 py-2 text-base outline-none placeholder:text-muted/60 focus:border-accent-dim";
