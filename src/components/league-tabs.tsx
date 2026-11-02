"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

const TABS = [
  { segment: null, href: "", label: "Events" },
  { segment: "players", href: "/players", label: "Players" },
  { segment: "decks", href: "/decks", label: "Decks" },
] as const;

/** Events / Players / Decks, under a league's title. */
export function LeagueTabs({ leagueId }: { leagueId: string }) {
  const active = useSelectedLayoutSegment();
  return (
    <nav aria-label="League" className="mb-7 flex gap-1 border-b border-hair">
      {TABS.map((t) => {
        const on = active === t.segment;
        return (
          <Link
            key={t.label}
            href={`/leagues/${leagueId}${t.href}`}
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
