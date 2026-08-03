import { awardDevotion } from "@/lib/devotion";
import { profileSelect } from "@/lib/server-game-rules";
import { PET_TASK_REWARD, PET_WORSHIP_MIN_AMOUNT, PET_WORSHIP_DOWNLOAD_COST } from "@/lib/pet-tasks-content";
import { getTodaysWorshipImage } from "@/lib/pet-worship";
import { getDailyGmt3CooldownUntil, getGmt3DateKey } from "@/lib/time";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  coins: number;
  pet_score: number | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: jsonError(authError?.message ?? "Authentication required.", 401), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId!;

  const { category, imageKey } = await getTodaysWorshipImage();

  let unlocked = false;
  if (imageKey) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("user_worship_unlocks")
      .select("image_key")
      .eq("user_id", userId)
      .eq("image_key", imageKey)
      .maybeSingle();
    unlocked = Boolean(data);
  }

  return Response.json({ category, imagePath: imageKey, unlocked });
}

async function handleWorshipDownload(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { category, imageKey } = await getTodaysWorshipImage();

  if (!imageKey) {
    return jsonError("No worship image available today.", 404);
  }

  const { data: existingUnlock } = await supabase
    .from("user_worship_unlocks")
    .select("image_key")
    .eq("user_id", userId)
    .eq("image_key", imageKey)
    .maybeSingle();

  if (existingUnlock) {
    return Response.json({ alreadyUnlocked: true, imagePath: imageKey, category });
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const profile = profileData as ProfileRow;
  if (profile.coins < PET_WORSHIP_DOWNLOAD_COST) {
    return jsonError(`Downloading costs ${PET_WORSHIP_DOWNLOAD_COST} coins.`, 402);
  }

  const now = new Date().toISOString();
  const nextCoins = profile.coins - PET_WORSHIP_DOWNLOAD_COST;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", profile.coins)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Download purchase was stale.", updateError ? 500 : 409);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -PET_WORSHIP_DOWNLOAD_COST,
    balance_after: nextCoins,
    balance_before: profile.coins,
    metadata: { category, imageKey },
    reason: "download:pet-worship",
    user_id: userId,
  });

  if (transactionError) {
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
    return jsonError("Download purchase logging failed.", 500);
  }

  const { error: unlockError } = await supabase
    .from("user_worship_unlocks")
    .insert({ user_id: userId, image_key: imageKey });

  if (unlockError && (unlockError as { code?: string }).code !== "23505") {
    console.error("[pet-worship] unlock record failed", unlockError);
  }

  return Response.json({ profile: updatedProfile, imagePath: imageKey, category, alreadyUnlocked: false });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId!;
  const body = (await request.json().catch(() => null)) as { action?: string; amount?: number; compliment?: string } | null;

  if (body?.action === "download") {
    return handleWorshipDownload(userId);
  }

  const amount = Math.floor(Number(body?.amount));
  const compliment = typeof body?.compliment === "string" ? body.compliment.trim().slice(0, 500) : "";

  if (!Number.isFinite(amount) || amount < PET_WORSHIP_MIN_AMOUNT) {
    return jsonError(`Send at least ${PET_WORSHIP_MIN_AMOUNT} coins.`, 422);
  }

  if (!compliment) {
    return jsonError("Write your worship line before sending.", 422);
  }

  const supabase = createSupabaseAdminClient();

  const [profileResult, existingTaskResult] = await Promise.all([
    supabase.from("profiles").select(profileSelect).eq("id", userId).single(),
    supabase.from("user_pet_tasks").select("completed_at").eq("user_id", userId).eq("task_id", "pet-worship").maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  const cooldownUntil = getDailyGmt3CooldownUntil(existingTaskResult.data?.completed_at ?? null);
  if (cooldownUntil) {
    return jsonError("Today's worship has already been sent.", 409);
  }

  const profile = profileResult.data as ProfileRow;
  if (profile.coins < amount) {
    return jsonError("Not enough coins for that tribute.", 402);
  }

  const { category, imageKey } = await getTodaysWorshipImage();
  const now = new Date().toISOString();
  const nextCoins = profile.coins - amount;
  const nextPetScore = (profile.pet_score ?? 0) + PET_TASK_REWARD;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, pet_score: nextPetScore, updated_at: now })
    .eq("id", userId)
    .eq("coins", profile.coins)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Worship tribute was stale.", updateError ? 500 : 409);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: -amount,
    balance_after: nextCoins,
    balance_before: profile.coins,
    metadata: { category, compliment, imageKey },
    reason: "tribute:pet-worship",
    user_id: userId,
  });

  if (transactionError) {
    await supabase.from("profiles").update({ coins: profile.coins, pet_score: profile.pet_score, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
    return jsonError("Worship tribute logging failed.", 500);
  }

  const devotionAward = Math.max(1, Math.floor(amount / PET_WORSHIP_MIN_AMOUNT));
  try {
    await awardDevotion(supabase, {
      amount: devotionAward,
      metadata: { category, spendAmount: amount },
      source: "pet_worship",
      sourceKey: `pet-worship:${userId}:${getGmt3DateKey()}`,
      userId,
    });
  } catch (devotionError) {
    console.error("[pet-worship] devotion award failed", devotionError);
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("user_pet_tasks")
    .upsert(
      {
        user_id: userId,
        task_id: "pet-worship",
        completed_at: now,
        reviewed_at: now,
        reward_score: PET_TASK_REWARD,
        status: "approved",
        metadata: { amount, category, imageKey, compliment },
      },
      { onConflict: "user_id,task_id" },
    )
    .select("*")
    .maybeSingle();

  if (taskError || !taskRow) {
    console.error("[pet-worship] task state record failed", taskError);
  }

  return Response.json({ profile: updatedProfile, task: taskRow ?? null });
}
