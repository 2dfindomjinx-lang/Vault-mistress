import manifest from "@/lib/generated/overlay-manifest.json";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(manifest, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
