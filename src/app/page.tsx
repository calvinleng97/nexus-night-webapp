import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { signInAction } from "./auth-actions";

/** No marketing page: signed in goes straight to the leagues list. */
export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/leagues");
  const cfg = loadConfig();

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <div className="text-2xl text-accent">◆</div>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{cfg.site.name}</h1>
      <form action={signInAction} className="mt-7">
        <button className="rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20">
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
