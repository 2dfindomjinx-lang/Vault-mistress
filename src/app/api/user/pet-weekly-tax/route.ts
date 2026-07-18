import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PET_WEEKLY_TAX_MIN_COST = 2500;
const PET_WEEKLY_TAX_MAX_COST = 10000;
const PET_WEEKLY_TAX_REWARD = 20;
const PET_WEEKLY_TAX_TASK_ID = "pet-weekly-throne-tax";

type ProfileRow = {
  coins: number;
  id: string;
  last_pet_tax_at: string | null;
  pet_score: number | null;
  pet_unlocked_at: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getPetWeeklyTaxCost(coins: number) {
  return Math.min(
    PET_WEEKLY_TAX_MAX_COST,
    Math.max(PET_WEEKLY_TAX_MIN_COST, Math.floor(coins * 0.2)),
  );
}

function getNextDueAt(profile: ProfileRow) {
  const anchor = profile.last_pet_tax_at ?? profile.pet_unlocked_at;
  const anchorMs = anchor ? new Date(anchor).getTime() : Number.NaN;

  return Number.isFinite(anchorMs)
    ? new Date(anchorMs + WEEK_MS).toISOString()
    : null;
}

export async function POST() {
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

  const userId = authData.user.id;
  const supabase = createSupabaseAdminClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", profileError ? 500 : 404);
  }

  const profile = profileData as ProfileRow;
  const nextDueAt = getNextDueAt(profile);

  if (!profile.pet_unlocked_at || !nextDueAt) {
    return Response.json({
      collected: false,
      nextDueAt: null,
      profile: profileData,
      reason: "pet_locked",
    });
  }

  if (Date.now() < new Date(nextDueAt).getTime()) {
    return Response.json({
      collected: false,
      nextDueAt,
      profile: profileData,
      reason: "not_due",
    });
  }

  const cost = Math.min(getPetWeeklyTaxCost(profile.coins), profile.coins);

  if (cost <= 0) {
    return Response.json({
      collected: false,
      nextDueAt,
      profile: profileData,
      reason: "insufficient_coins",
    });
  }

  const completedAt = new Date().toISOString();
  const nextCoins = profile.coins - cost;
  const nextPetScore = (profile.pet_score ?? 0) + PET_WEEKLY_TAX_REWARD;

  let updateQuery = supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      last_pet_tax_at: completedAt,
      pet_score: nextPetScore,
      updated_at: completedAt,
    })
    .eq("id", userId)
    .eq("coins", profile.coins);

  updateQuery = profile.pet_score === null
    ? updateQuery.is("pet_score", null)
    : updateQuery.eq("pet_score", profile.pet_score);

  updateQuery = profile.last_pet_tax_at
    ? updateQuery.eq("last_pet_tax_at", profile.last_pet_tax_at)
    : updateQuery.is("last_pet_tax_at", null);

  const { data: updatedProfile, error: updateError } = await updateQuery
    .select(profileSelect)
    .maybeSingle();

  if (updateError) {
    console.error("[pet-weekly-tax] profile update failed", {
      error: updateError,
      userId,
    });
    return jsonError(updateError.message, 500);
  }

  if (!updatedProfile) {
    const { data: latestProfile, error: latestProfileError } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .single();

    if (latestProfileError || !latestProfile) {
      return jsonError(
        latestProfileError?.message ?? "Weekly tax state could not be refreshed.",
        500,
      );
    }

    return Response.json({
      collected: false,
      nextDueAt: getNextDueAt(latestProfile as ProfileRow),
      profile: latestProfile,
      reason: "already_collected",
    });
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -cost,
    balance_after: nextCoins,
    balance_before: profile.coins,
    metadata: {
      autoCollected: true,
      reward: -cost,
      source: "spend:pet-weekly-tax",
      spendAmount: cost,
    },
    reason: "spend:pet-weekly-tax",
    user_id: userId,
  });

  if (transactionError) {
    console.error("[pet-weekly-tax] coin transaction insert failed", {
      error: transactionError,
      userId,
    });

    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({
        coins: profile.coins,
        last_pet_tax_at: profile.last_pet_tax_at,
        pet_score: profile.pet_score ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("coins", nextCoins)
      .eq("last_pet_tax_at", completedAt)
      .eq("pet_score", nextPetScore);

    if (rollbackError) {
      console.error("[pet-weekly-tax] rollback failed", {
        error: rollbackError,
        userId,
      });
    }

    return jsonError("Weekly tax coin logging failed.", 500);
  }

  const { data: existingTask, error: existingTaskError } = await supabase
    .from("user_pet_tasks")
    .select("metadata")
    .eq("user_id", userId)
    .eq("task_id", PET_WEEKLY_TAX_TASK_ID)
    .maybeSingle();

  if (existingTaskError) {
    console.error("[pet-weekly-tax] existing task lookup failed", {
      error: existingTaskError,
      userId,
    });
  }

  const { error: taskError } = await supabase
    .from("user_pet_tasks")
    .upsert(
      {
        completed_at: completedAt,
        metadata: {
          ...((existingTask?.metadata as Record<string, unknown> | null) ?? {}),
          autoCollected: true,
          cost,
        },
        reviewed_at: completedAt,
        reward_score: PET_WEEKLY_TAX_REWARD,
        status: "approved",
        task_id: PET_WEEKLY_TAX_TASK_ID,
        user_id: userId,
      },
      { onConflict: "user_id,task_id" },
    );

  if (taskError) {
    console.error("[pet-weekly-tax] task state update failed", {
      error: taskError,
      userId,
    });
  }

  return Response.json({
    collected: true,
    completedAt,
    cost,
    nextDueAt: new Date(new Date(completedAt).getTime() + WEEK_MS).toISOString(),
    profile: updatedProfile,
    taskStateWarning: taskError ? "Weekly tax task state could not be updated." : null,
  });
}
