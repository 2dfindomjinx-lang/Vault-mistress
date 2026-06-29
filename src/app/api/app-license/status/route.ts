import { PRINCIPESSA_DISCIPLINE_APP_KEY } from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      error: "Offline licenses are used after activation. This route is intentionally disabled.",
      appKey: PRINCIPESSA_DISCIPLINE_APP_KEY,
    },
    { status: 410 },
  );
}
