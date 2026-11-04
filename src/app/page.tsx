import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { btn } from "@/components/ui";
import { signInAction } from "./auth-actions";

/** No marketing page: signed in goes straight home. */
export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/leagues");
  const cfg = loadConfig();

  return (
    <div className="flex min-h-[65dvh] flex-col items-center justify-center text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-3xl text-accent">
        ◆
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">{cfg.site.name}</h1>
      <form action={signInAction} className="mt-8 w-full max-w-xs">
        <button className={btn("solid", "lg", true)}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-5">
            <path
              fill="currentColor"
              d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.62 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.84 0 3.07.78 3.77 1.45l2.57-2.48C16.7 3.83 14.56 2.9 12 2.9a9.1 9.1 0 1 0 0 18.2c5.25 0 8.73-3.69 8.73-8.89 0-.6-.07-1.05-.15-1.5z"
            />
          </svg>
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
