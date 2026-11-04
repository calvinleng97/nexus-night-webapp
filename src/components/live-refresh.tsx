"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 3000;

/**
 * Keeps an event page current while it is open: polls the event's version and
 * re-renders the server components when someone else changes it (e.g. the
 * opponent submits a score, so this player's form turns into a confirm).
 */
export function LiveRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    let last: string | null = null;
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
            if (last !== null && version !== last) router.refresh();
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
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId, router]);

  return null;
}
