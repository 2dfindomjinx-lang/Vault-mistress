import { readdir } from "node:fs/promises";
import path from "node:path";
import { awardDevotion } from "@/lib/devotion";
import { profileSelect } from "@/lib/server-game-rules";
import { PET_TASK_REWARD, PET_WORSHIP_MIN_AMOUNT, PET_WORSHIP_CATEGORIES, type PetWorshipCategory } from "@/lib/pet-tasks-content";
import { getDailyGmt3CooldownUntil, getGmt3DateKey, getGmt3DayIndex } from "@/lib/time";
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

async function getWorshipImageFileNames(category: PetWorshipCategory) {
  const dir = path.join(process.cwd(), "public", "worship", category);

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(avif|gif|jfif|jpe?g|png|webp)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException | null;
    if (nodeError?.code !== "ENOENT") {
      console.error("[pet-worship] image directory read failed", error);
    }
    return [] as string[];
  }
}

function getTodaysWorshipCategory(): PetWorshipCategory {
  const dayIndex = getGmt3DayIndex();
  return PET_WORSHIP_CATEGORIES[dayIndex % PET_WORSHIP_CATEGORIES.length];
}

// Scatters the pick across the folder independent of filename/sort order,
// while staying stable for the whole day (same image on every reload today).
function hashDailyPick(seed: string, optionCount: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % optionCount;
}

async function getTodaysWorshipImage() {
  const category = getTodaysWorshipCategory();
  const fileNames = await getWorshipImageFileNames(category);

  if (fileNames.length === 0) {
    return { category, imagePath: null as string | null };
  }

  const dayIndex = getGmt3DayIndex();
  const fileName = fileNames[hashDailyPick(`${category}:${dayIndex}`, fileNames.length)];
  return { category, imagePath: `/worship/${category}/${fileName}` };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const { category, imagePath } = await getTodaysWorshipImage();
  return Response.json({ category, imagePath });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId!;
  const body = (await request.json().catch(() => null)) as { amount?: number; compliment?: string } | null;
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

  const { category, imagePath } = await getTodaysWorshipImage();
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
    metadata: { category, compliment, imagePath },
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
        metadata: { amount, category, imagePath, compliment },
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
