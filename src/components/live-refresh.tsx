"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVAL_MS = 3000;
/** A change this soon after your own submit is yours, not news. */
const OWN_CHANGE_MS = 6000;
const FLASH_MS = 2200;

/**
 * Keeps an event page current while it is open: polls the event's version and
 * re-renders the server components when someone else changes it (e.g. the
 * opponent submits a score, so this player's form turns into a confirm).
 *
 * When the change came from someone else, a small "Updated" pill flashes so
 * the page visibly moving under you reads as news rather than a glitch.
 */
export function LiveRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let last: string | null = null;
    let ownSubmitAt = 0;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const onSubmit = () => {
      ownSubmitAt = Date.now();
    };
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (stopped || busy) return;
      busy = true;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/events/${eventId}/version`, { cache: "no-store" });
          if (res.ok) {
            const { version } = (await res.json()) as { version: string };
            if (last !== null && version !== last) {
              router.refresh();
              if (Date.now() - ownSubmitAt > OWN_CHANGE_MS) {
                setFlash(true);
                clearTimeout(flashTimer);
                flashTimer = setTimeout(() => setFlash(false), FLASH_MS);
              }
            }
            last = version;
          }
        } catch {
          // Offline or server restarting: try again next tick.
        }
      }
      busy = false;
      if (!stopped) timer = setTimeout(tick, INTERVAL_MS);
    }

    // Catch up immediately when the tab comes back into view.
    function onVisible() {
      if (document.visibilityState === "visible") void tick();
    }

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(flashTimer);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [eventId, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-[4.25rem] z-40 flex justify-center transition-all duration-300 ${
        flash ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {/* Kept mounted so it can fade out; only its text is announced. */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-win/35 bg-ink/90 px-3 py-1 text-xs font-medium text-win shadow-lg shadow-black/50 backdrop-blur">
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {flash ? "Updated" : <span aria-hidden>Updated</span>}
      </span>
    </div>
  );
}
