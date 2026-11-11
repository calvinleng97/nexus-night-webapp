import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { userIdFromGoogleSub } from "./ids";
import { upsertUser } from "./store/repo";

/** Callback query values that are secrets or one-shot credentials. */
const REDACTED_PARAMS = new Set(["code", "state", "id_token", "access_token"]);

/**
 * Auth.js's default logger JSON-stringifies error details, which turns the
 * callback's URLSearchParams into `{}`. That hides exactly what we need when
 * Google's reply fails validation (e.g. an unexpected `iss`), so print the
 * parameters as a plain object, with credentials blanked.
 */
function logAuthError(error: Error) {
  const type = (error as { type?: string }).type ?? error.name;
  console.error(`[auth][error] ${type}: ${error.message}`);
  const cause = error.cause;
  if (!cause || typeof cause !== "object") {
    if (error.stack) console.error(error.stack);
    return;
  }
  const { err, ...data } = cause as Record<string, unknown>;
  if (err instanceof Error) console.error("[auth][cause]:", err.stack);
  const details = Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (!(value instanceof URLSearchParams)) return [key, value];
      const params = Object.fromEntries(
        [...value.entries()].map(([k, v]) => [k, REDACTED_PARAMS.has(k) ? "[redacted]" : v]),
      );
      return [key, params];
    }),
  );
  console.error("[auth][details]:", JSON.stringify(details, null, 2));
}

/**
 * Google is the only identity provider. Sessions are JWT-backed (no database
 * adapter) and the JSON store keeps its own user record, keyed by a hash of
 * Google's stable `sub` claim, so a user's id never changes if they rename
 * their account or change their email.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Failed sign-ins land back on the home page, which forwards anyone who is
  // in fact signed in (e.g. a duplicate callback after a good one) to /leagues.
  pages: { signIn: "/", error: "/" },
  logger: { error: logAuthError },
  callbacks: {
    async jwt({ token, profile }) {
      // `profile` is only present on the request that completes a sign-in.
      if (profile?.sub) {
        const user = await upsertUser({
          googleSub: profile.sub,
          email: typeof profile.email === "string" ? profile.email : "",
          name:
            (typeof profile.name === "string" && profile.name) ||
            (typeof profile.email === "string" ? profile.email.split("@")[0]! : "Player"),
          image: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.uid = user.id;
      } else if (!token.uid && token.sub) {
        token.uid = userIdFromGoogleSub(token.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

/** The signed-in user's store id, or null when not signed in. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("You need to be signed in to do that.");
  return id;
}
