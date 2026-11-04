import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { BottomNav, TopNav } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { signOutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Night",
  description: "Swiss-paired Nexus Night events.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0e",
  viewportFit: "cover",
};

export default async function RootLayout(props: LayoutProps<"/">) {
  const session = await auth();
  const cfg = loadConfig();
  const signedIn = !!session?.user;
  const name = session?.user?.name ?? "Player";

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-hair-soft bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-6 px-4 sm:px-6">
            <Link
              href={signedIn ? "/leagues" : "/"}
              className="flex shrink-0 items-center gap-2 text-[0.95rem] font-semibold tracking-tight"
            >
              <span className="text-lg leading-none text-accent">◆</span>
              {cfg.site.name}
            </Link>

            {signedIn ? (
              <>
                <TopNav />
                <details className="group relative ml-auto">
                  <summary
                    className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-raised sm:pr-3"
                    aria-label="Account"
                  >
                    <Avatar name={name} image={session.user.image ?? null} size="sm" />
                    <span className="hidden max-w-[14ch] truncate text-sm text-fg-dim sm:inline">
                      {name}
                    </span>
                  </summary>
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-hair bg-raised p-1 shadow-2xl shadow-black/50">
                    <p className="truncate px-3 py-2 text-sm text-fg-dim">{name}</p>
                    <form action={signOutAction}>
                      <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-hover">
                        Sign out
                      </button>
                    </form>
                  </div>
                </details>
              </>
            ) : null}
          </div>
        </header>
        <main
          className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8"
        >
          {props.children}
        </main>
        <footer
          className={`mx-auto max-w-3xl px-4 sm:px-6 ${signedIn ? "pb-24 sm:pb-10" : "pb-10"}`}
        >
          <div className="flex items-center gap-4 border-t border-hair-soft pt-5 text-xs text-fg-faint">
            <span>{cfg.site.name}</span>
            <Link href="/privacy" className="ml-auto transition-colors hover:text-fg-dim">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-fg-dim">
              Terms
            </Link>
          </div>
        </footer>
        {signedIn ? <BottomNav /> : null}
      </body>
    </html>
  );
}
