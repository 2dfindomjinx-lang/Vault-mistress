import { profileSelect } from "@/lib/server-game-rules";
import { cleanUsernameCandidate } from "@/lib/supabase/client";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  avatarUrl?: string | null;
  // username is no longer accepted for generation; server derives unique site username from X metadata on first creation
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function normalizeTwitterHandle(metadata: any): string {
  const meta = metadata ?? {};
  const candidate =
    meta.screen_name ??
    meta.user_name ??
    meta.preferred_username ??
    meta.name ??
    meta.full_name ??
    "";
  return cleanUsernameCandidate(String(candidate));
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
  const now = new Date().toISOString();

  const metadata = authData.user.user_metadata ?? {};
  const twitterBase = normalizeTwitterHandle(metadata) || `vault_${authData.user.id.slice(0, 8)}`;
  const rawTwitterHandle =
    metadata.screen_name ??
    metadata.user_name ??
    metadata.preferred_username ??
    metadata.name ??
    metadata.full_name ??
    null;

  // Always check for existing profile by stable id (never by X handle)
  const { data: existing } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", authData.user.id)
    .maybeSingle();

  if (existing) {
    // Existing user: update twitter_handle if changed, login time. NEVER auto-rename username.
    const updates: Record<string, any> = {
      last_login_at: now,
      updated_at: now,
    };
    if (rawTwitterHandle && rawTwitterHandle !== (existing as any).twitter_handle) {
      updates.twitter_handle = rawTwitterHandle;
    }
    await supabase
      .from("profiles")
      .update(updates)
      .eq("id", authData.user.id);
    // Re-fetch to return fresh (may have updated twitter_handle)
    const { data: refreshed } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", authData.user.id)
      .single();
    return Response.json({ profile: refreshed ?? existing });
  }

  // First time creation: derive unique site username from Twitter/X handle base
  // Stable identity is always the auth id. Site username is made unique here.
  let chosenUsername = `@${twitterBase}`;
  let suffix = 2;
  const MAX_TRIES = 200;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", chosenUsername)
      .maybeSingle();

    if (!taken) {
      break;
    }
    chosenUsername = `@${twitterBase}${suffix}`;
    suffix += 1;
  }

  // Create the profile with the unique site username + store the X handle separately
  const insertData: any = {
    affection: 0,
    avatar_url: body?.avatarUrl ?? null,
    coins: 100,
    id: authData.user.id,
    daily_purchase_count: 0,
    equipped_avatar_slots: { fullBody: "classic" },
    has_uncensored_avatar: false,
    last_login_at: now,
    owner_likeness: 100,
    pet_score: 0,
    right_expirations: [],
    right_purchase_date: null,
    stored_rights: 0,
    tribute_total: 0,
    updated_at: now,
    user_level: 1,
    user_xp: 0,
    username: chosenUsername,
    twitter_handle: rawTwitterHandle,
  };

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert(insertData)
    .select(profileSelect)
    .single();

  if (createError || !created) {
    // Fallback rare case: try with id suffix if unique violation on username
    if (createError?.code === "23505") {
      const fallback = `@${twitterBase}_${authData.user.id.slice(0, 6)}`;
      const { data: fb, error: fbErr } = await supabase
        .from("profiles")
        .insert({ ...insertData, username: fallback })
        .select(profileSelect)
        .single();
      if (fbErr || !fb) {
        return jsonError(fbErr?.message ?? "Profile could not be created.", 500);
      }
      // Seed default fullbody for fallback
      try {
        await supabase.from("user_crate_inventory").upsert(
          { user_id: authData.user.id, item_id: "classic", variant: "normal", quantity: 1 },
          { onConflict: "user_id,item_id,variant" }
        );
      } catch {
        // ignore inventory seed error
      }
      return Response.json({ profile: fb });
    }
    return jsonError(createError?.message ?? "Profile could not be created.", 500);
  }

  // Seed default "classic" fullbody unlocked + equipped for every new user
  try {
    await supabase.from("user_crate_inventory").upsert(
      { user_id: authData.user.id, item_id: "classic", variant: "normal", quantity: 1 },
      { onConflict: "user_id,item_id,variant" }
    );
  } catch {
    // ignore inventory seed error
  }

  return Response.json({ profile: created });
}
