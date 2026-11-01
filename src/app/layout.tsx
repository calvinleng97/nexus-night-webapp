import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { signOutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Night",
  description: "Swiss-paired Nexus Night events.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0c",
};

export default async function RootLayout(props: LayoutProps<"/">) {
  const session = await auth();
  const cfg = loadConfig();
  const signedIn = !!session?.user;

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-hair-soft bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-5 px-4 sm:px-6">
            <Link
              href={signedIn ? "/leagues" : "/"}
              className="shrink-0 text-sm font-semibold tracking-tight"
            >
              <span className="text-accent">◆</span>
              <span className="ml-1.5 hidden sm:inline">{cfg.site.name}</span>
            </Link>

            {signedIn ? (
              <>
                <nav className="flex items-center gap-1 text-sm">
                  <Link
                    href="/leagues"
                    className="rounded-lg px-2.5 py-1.5 text-fg-dim transition-colors hover:bg-raised hover:text-fg"
                  >
                    Leagues
                  </Link>
                  <Link
                    href="/history"
                    className="rounded-lg px-2.5 py-1.5 text-fg-dim transition-colors hover:bg-raised hover:text-fg"
                  >
                    History
                  </Link>
                </nav>
                <div className="ml-auto flex items-center gap-3 text-sm">
                  <span className="hidden max-w-[14ch] truncate text-fg-faint sm:inline">
                    {session.user.name}
                  </span>
                  <form action={signOutAction}>
                    <button className="rounded-lg px-2 py-1.5 text-fg-faint transition-colors hover:text-fg">
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-7 pb-24 sm:px-6">{props.children}</main>
      </body>
    </html>
  );
}
