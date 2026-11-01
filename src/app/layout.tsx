import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { signInAction, signOutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Night",
  description: "Run Swiss-paired Nexus Night events with your friends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0d13",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cfg = loadConfig();

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="text-accent">◆</span> {cfg.site.name}
            </Link>
            <nav className="ml-auto flex items-center gap-4 text-sm">
              {session?.user ? (
                <>
                  <Link href="/leagues" className="text-muted hover:text-white">
                    Leagues
                  </Link>
                  <span className="hidden max-w-[12ch] truncate text-muted sm:inline">
                    {session.user.name}
                  </span>
                  <form action={signOutAction}>
                    <button className="text-muted underline hover:text-white">Sign out</button>
                  </form>
                </>
              ) : (
                <form action={signInAction}>
                  <button className="rounded-lg border border-accent-dim bg-accent/15 px-3 py-1.5 font-medium text-accent">
                    Sign in with Google
                  </button>
                </form>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 pb-20">{children}</main>
      </body>
    </html>
  );
}
