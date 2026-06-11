import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  avatarUrl?: string | null;
  username?: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function cleanUsername(value: unknown) {
  return String(value ?? "vault_user").trim().replace(/\s+/g, "_").slice(0, 40) || "vault_user";
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
  const supabase = createSupabaseAdminClient();
  const baseUsername = cleanUsername(body?.username);

  const createProfile = async (username: string) => supabase
    .from("profiles")
    .upsert(
      {
        affection: 0,
        avatar_url: body?.avatarUrl ?? null,
        coins: 100,
        email: authData.user.email ?? null,
        id: authData.user.id,
        daily_purchase_count: 0,
        last_login_at: new Date().toISOString(),
        owner_likeness: 100,
        pet_score: 0,
        right_expirations: [],
        right_purchase_date: null,
        stored_rights: 0,
        tribute_total: 0,
        updated_at: new Date().toISOString(),
        user_level: 1,
        user_xp: 0,
        username,
      },
      { ignoreDuplicates: true, onConflict: "id" },
    )
    .select(profileSelect)
    .single();

  let result = await createProfile(baseUsername);

  if (result.error?.code === "23505") {
    result = await createProfile(`${baseUsername}_${authData.user.id.slice(0, 6)}`);
  }

  if (result.error || !result.data) {
    return jsonError(result.error?.message ?? "Profile could not be created.", 500);
  }

  return Response.json({ profile: result.data });
}
