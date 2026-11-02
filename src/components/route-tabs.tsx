"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type RouteTab = {
  /** The child segment this tab shows, or null for the layout's own page. */
  segment: string | null;
  label: string;
};

/**
 * A row of tabs under a page title, one per child route of the layout that
 * renders it. The active tab comes from the URL, so it survives reloads and
 * links straight to a tab work.
 */
export function RouteTabs({ base, tabs, label }: { base: string; tabs: RouteTab[]; label: string }) {
  const active = useSelectedLayoutSegment();
  return (
    <nav aria-label={label} className="mb-7 flex gap-1 border-b border-hair">
      {tabs.map((t) => {
        const on = active === t.segment;
        return (
          <Link
            key={t.label}
            href={t.segment ? `${base}/${t.segment}` : base}
            aria-current={on ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[0.95rem] font-medium transition-colors ${
              on
                ? "border-accent text-fg"
                : "border-transparent text-fg-faint hover:text-fg-dim"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
