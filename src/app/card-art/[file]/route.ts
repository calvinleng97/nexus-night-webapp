import { getCardArt, isCardFile } from "@/lib/card-art-store";

/**
 * One card image, served from the server's own copy (see card-art-store).
 * Public on purpose: these are Riot's published cards, and next/image fetches
 * them from here without the viewer's session.
 */
export async function GET(_req: Request, ctx: RouteContext<"/card-art/[file]">) {
  const { file } = await ctx.params;
  if (!isCardFile(file)) return new Response(null, { status: 404 });
  try {
    const body = await getCardArt(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(body.length),
        // A card file never changes under the same name.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // The wiki is unreachable and we have no copy yet: try again later.
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
