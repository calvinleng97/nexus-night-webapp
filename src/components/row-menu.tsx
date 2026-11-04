"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A ⋯ button that opens a small menu of actions for one row. Secondary,
 * per-record actions live here so the row itself stays calm; it closes on a
 * tap outside or Escape.
 */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node))
        el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={label}
        title={label}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg text-fg-faint transition-colors hover:bg-raised hover:text-fg group-open:bg-raised group-open:text-fg"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.5" cy="8" r="1.4" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex w-52 flex-col gap-0.5 rounded-xl border border-hair bg-raised p-1 shadow-2xl shadow-black/60 [&_button]:w-full [&_button]:justify-start [&_form>div]:w-full">
        {children}
      </div>
    </details>
  );
}
