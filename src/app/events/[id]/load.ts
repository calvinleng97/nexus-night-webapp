import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import type { UserId } from "@/lib/domain/types";
import { getEvent, getUsers } from "@/lib/store/repo";
import type { WhoFn } from "@/components/event-bits";

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
  const who: WhoFn = (uid: UserId) => {
    const u = users.get(uid);
    return { name: u?.name ?? "Unknown", image: u?.image ?? null };
  };
  const nameOf = (uid: UserId | null) => (uid ? who(uid).name : "—");
  const myPlayer = event.players.find((p) => p.userId === userId) ?? null;

  // Registered Legends, snapshotted on the player when they signed up.
  const legends = new Map(
    event.players.filter((p) => p.deck?.legend).map((p) => [p.userId, p.deck!.legend!]),
  );
  const legendOf = (uid: UserId) => legends.get(uid) ?? null;

  return {
    userId,
    event,
    who,
    nameOf,
    legendOf,
    myPlayer,
    isPlayer: myPlayer !== null,
    isManager: event.managerIds.includes(userId),
  };
}
