import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  timeoutUntil?: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function isValidTimeoutUntil(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time >= Date.now() - 60_000 && time <= Date.now() + 30 * 24 * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || !isValidTimeoutUntil(body.timeoutUntil)) {
    return jsonError("Invalid timeout payload.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      timeout_until: body.timeoutUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .select(profileSelect)
    .single();

  if (error || !updatedProfile) {
    return jsonError(error?.message ?? "Timeout update failed.", 500);
  }

  return Response.json({ profile: updatedProfile });
}
