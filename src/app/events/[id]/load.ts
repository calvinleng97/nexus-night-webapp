import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import type { User, UserId } from "@/lib/domain/types";
import { getEvent, getUsers } from "@/lib/store/repo";

/**
 * What every event tab needs: the signed-in viewer, the event, and names for
 * everyone on it. Each tab page calls this itself rather than trusting the
 * layout, since a layout is not a guard.
 */
export async function loadEventView(id: string) {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const event = await getEvent(id);
  if (!event) notFound();

  const users = await getUsers([...event.players.map((p) => p.userId), ...event.managerIds]);
  const nameOf = (uid: UserId | null) =>
    uid ? ((users as Map<UserId, User>).get(uid)?.name ?? "Unknown") : "—";
  const myPlayer = event.players.find((p) => p.userId === userId) ?? null;

  return {
    userId,
    event,
    nameOf,
    myPlayer,
    isPlayer: myPlayer !== null,
    isManager: event.managerIds.includes(userId),
  };
}
