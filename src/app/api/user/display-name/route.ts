import { validateDisplayName } from "@/lib/supabase/client";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  displayName?: string;
  useRight?: boolean;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const validation = validateDisplayName(body?.displayName, {
    allowExactPrincipessa: isTrustedAdminUserId(authData.user.id),
  });

  if (!validation.valid || !validation.normalized) {
    return jsonError(validation.error ?? "Invalid display name.", 400);
  }

  const desired = validation.normalized;
  const useRight = !!body?.useRight;
  const supabase = createSupabaseAdminClient();
  const userId = authData.user.id;
  const now = new Date().toISOString();

  if (useRight) {
    // Check for and consume the purchased right (no coins charged)
    const { data: rightOwned } = await supabase
      .from("user_cosmetics")
      .select("id")
      .eq("user_id", userId)
      .eq("item_id", "display-name-change")
      .maybeSingle();

    if (!rightOwned) {
      return jsonError("You do not have an unused Display Name Change right.", 402);
    }

    await supabase
      .from("user_cosmetics")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", "display-name-change");

    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({ display_name: desired, updated_at: now })
      .eq("id", userId)
      .select(profileSelect)
      .single();

    if (updateErr || !updated) {
      return jsonError("Failed to change display name.", 500);
    }
    return Response.json({ profile: updated, usedRight: true });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, coins")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[display-name] profile lookup failed", profileError);
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const currentDisplay = (profile.display_name ?? "").trim();
  const isFirstSetup = currentDisplay.length === 0;

  const cost = isFirstSetup ? 0 : 2500;
  const previousCoins = Number(profile.coins ?? 0);

  if (cost > 0 && previousCoins < cost) {
    return jsonError("Not enough coins to change display name.", 402);
  }

  const nextCoins = cost > 0 ? previousCoins - cost : previousCoins;

  // Optimistic update for coins if charging
  let updatedProfile: any = null;
  if (cost > 0) {
    const { data: coinUpdated, error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, display_name: desired, updated_at: now })
      .eq("id", userId)
      .eq("coins", previousCoins)
      .select(profileSelect)
      .maybeSingle();

    if (coinErr || !coinUpdated) {
      console.error("[display-name] paid update failed", coinErr);
      return jsonError(coinErr?.message ?? "Display name change failed (stale coins).", coinErr ? 500 : 409);
    }
    updatedProfile = coinUpdated;
  } else {
    const { data: freeUpdated, error: freeErr } = await supabase
      .from("profiles")
      .update({ display_name: desired, updated_at: now })
      .eq("id", userId)
      .select(profileSelect)
      .maybeSingle();

    if (freeErr || !freeUpdated) {
      console.error("[display-name] free update failed", freeErr);
      return jsonError(freeErr?.message ?? "Failed to set display name.", 500);
    }
    updatedProfile = freeUpdated;
  }

  // Record ledger only for paid change
  if (cost > 0) {
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -cost,
      balance_before: previousCoins,
      balance_after: nextCoins,
      reason: "cosmetic:display_name_change",
      metadata: {
        previousDisplayName: currentDisplay || null,
        newDisplayName: desired,
      },
    });

    if (txErr) {
      console.error("[display-name] ledger insert failed", txErr);
      // rollback coins (best effort)
      await supabase
        .from("profiles")
        .update({ coins: previousCoins, updated_at: now })
        .eq("id", userId)
        .eq("coins", nextCoins);
      return jsonError("Display name change ledger failed.", 500);
    }
  }

  return Response.json({ profile: updatedProfile, isFirstSetup });
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !profile) {
    return jsonError(error?.message ?? "Profile not found.", 404);
  }

  return Response.json({
    displayName: profile.display_name ?? null,
    profile,
    username: profile.username,
  });
}
