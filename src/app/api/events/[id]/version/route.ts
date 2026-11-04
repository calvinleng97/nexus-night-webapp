import { currentUserId } from "@/lib/auth";
import { getEventVersion } from "@/lib/store/repo";

/** Polled by open event pages; see `LiveRefresh`. */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/version">) {
  if (!(await currentUserId())) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const version = await getEventVersion(id);
  if (!version) return new Response(null, { status: 404 });
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
