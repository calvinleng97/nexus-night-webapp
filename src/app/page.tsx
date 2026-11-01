import Link from "next/link";
import { auth } from "@/lib/auth";
import { Panel } from "@/components/ui";
import { signInAction } from "./auth-actions";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <section className="pt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Run your Nexus Nights without the spreadsheet.
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Swiss pairings over three rounds, byes handled properly, best-of-three results confirmed
          by both players, and every game kept on disk for stats later.
        </p>
        <div className="mt-5">
          {session?.user ? (
            <Link
              href="/leagues"
              className="inline-flex rounded-lg border border-accent-dim bg-accent/15 px-4 py-2 font-medium text-accent"
            >
              Go to your leagues
            </Link>
          ) : (
            <form action={signInAction}>
              <button className="rounded-lg border border-accent-dim bg-accent/15 px-4 py-2 font-medium text-accent">
                Sign in with Google to start
              </button>
            </form>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <h2 className="font-medium">Leagues</h2>
          <p className="mt-1 text-sm text-muted">
            A standing group of players. Anyone signed in can join one and show up to its events.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-medium">Events</h2>
          <p className="mt-1 text-sm text-muted">
            A single night. Players join, a manager starts it, and pairings generate themselves.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-medium">Rounds</h2>
          <p className="mt-1 text-sm text-muted">
            Report your best-of-three, your opponent confirms, and the next round appears.
          </p>
        </Panel>
      </div>
    </div>
  );
}
