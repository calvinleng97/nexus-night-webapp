import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { userIdFromGoogleSub } from "./ids";
import { upsertUser } from "./store/repo";

/**
 * Google is the only identity provider. Sessions are JWT-backed (no database
 * adapter) and the JSON store keeps its own user record, keyed by a hash of
 * Google's stable `sub` claim, so a user's id never changes if they rename
 * their account or change their email.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
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
