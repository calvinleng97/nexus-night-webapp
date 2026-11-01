"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInAction(): Promise<void> {
  await signIn("google", { redirectTo: "/leagues" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
