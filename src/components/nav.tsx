"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; match: (path: string) => boolean; icon: ReactNode };

const ICON = "size-[1.35rem]";
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: Item[] = [
  {
    href: "/leagues",
    label: "Home",
    // Leagues and events hang off home: that's where you got to them from.
    match: (p) => p === "/" || p.startsWith("/leagues") || p.startsWith("/events"),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
        <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/decks",
    label: "Decks",
    match: (p) => p.startsWith("/decks"),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
        <rect x="7" y="3.5" width="11" height="15" rx="2" />
        <path d="M4.5 7.5v11a2 2 0 0 0 2 2h8" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    match: (p) => p.startsWith("/history"),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
        <path d="M5 19V11M10 19V5M15 19v-6M20 19V8" />
      </svg>
    ),
  },
];

/** Inline links for the desktop header. */
export function TopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm sm:flex">
      {ITEMS.map((it) => {
        const on = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              on ? "bg-raised text-fg" : "text-fg-dim hover:bg-raised hover:text-fg"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Thumb-reach tab bar for phones. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-hair-soft bg-ink/90 backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3">
        {ITEMS.map((it) => {
          const on = it.match(path);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors ${
                on ? "text-accent" : "text-fg-faint hover:text-fg-dim"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
