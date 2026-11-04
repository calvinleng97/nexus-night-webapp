"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type RouteTab = {
  /** The child segment this tab shows, or null for the layout's own page. */
  segment: string | null;
  label: string;
  /** A count that needs someone's attention, shown as a red badge. */
  alert?: number;
};

/**
 * A row of tabs, one per child route of the layout that renders it. The
 * active tab comes from the URL, so it survives reloads and deep links.
 *
 * Two looks on purpose, so a glance tells you what kind of page you're on:
 * `segmented` (pills in a tray) belongs to leagues, `underline` to events.
 */
export function RouteTabs({
  base,
  tabs,
  label,
  variant = "underline",
}: {
  base: string;
  tabs: RouteTab[];
  label: string;
  variant?: "underline" | "segmented";
}) {
  const active = useSelectedLayoutSegment();

  const badge = (n?: number) =>
    n ? (
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-loss px-1 font-mono text-[0.7rem] font-semibold text-ink">
        {n}
      </span>
    ) : null;

  if (variant === "segmented")
    return (
      <nav
        aria-label={label}
        className="no-scrollbar flex gap-1 rounded-xl border border-hair-soft bg-ink/60 p-1"
      >
        {tabs.map((t) => {
          const on = active === t.segment;
          return (
            <Link
              key={t.label}
              href={t.segment ? `${base}/${t.segment}` : base}
              aria-current={on ? "page" : undefined}
              className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                on ? "bg-raised text-fg shadow-sm shadow-black/40" : "text-fg-faint hover:text-fg-dim"
              }`}
            >
              {t.label}
              {badge(t.alert)}
            </Link>
          );
        })}
      </nav>
    );

  return (
    <nav
      aria-label={label}
      className="no-scrollbar -mx-4 mb-7 flex gap-1 border-b border-hair-soft px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((t) => {
        const on = active === t.segment;
        return (
          <Link
            key={t.label}
            href={t.segment ? `${base}/${t.segment}` : base}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 pt-1 text-[0.95rem] font-medium transition-colors ${
              on ? "border-accent text-fg" : "border-transparent text-fg-faint hover:text-fg-dim"
            }`}
          >
            {t.label}
            {badge(t.alert)}
          </Link>
        );
      })}
    </nav>
  );
}
