import { getRebrandProfileWithAssetUrls } from "@/lib/rebrand-profile";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  consent?: boolean;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getMissingRebrandFields() {
  return [
    !process.env.X_REBRAND_WRITE_ENABLED || process.env.X_REBRAND_WRITE_ENABLED !== "true"
      ? "X_REBRAND_WRITE_ENABLED=true"
      : "",
    !process.env.X_REBRAND_API_KEY ? "X_REBRAND_API_KEY" : "",
    !process.env.X_REBRAND_API_SECRET ? "X_REBRAND_API_SECRET" : "",
  ].filter(Boolean);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.consent) {
    return jsonError("Explicit rebrand consent is required.", 403);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return jsonError(error?.message ?? "Authentication required.", 401);
  }

  const plannedProfile = getRebrandProfileWithAssetUrls(new URL(request.url).origin);
  const missingFields = getMissingRebrandFields();

  if (missingFields.length > 0) {
    return Response.json(
      {
        error:
          "X profile rebrand write integration is not configured yet. Add the required X write credentials before enabling this action.",
        missingFields,
        plannedProfile,
      },
      { status: 501 },
    );
  }

  return Response.json(
    {
      error:
        "X profile write transport is not connected yet. The consent gate and configuration guard are ready.",
      plannedProfile,
    },
    { status: 501 },
  );
}
