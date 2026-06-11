import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getGmt3DateKey } from "@/lib/time";

type Body = {
  metadata?: Record<string, unknown>;
  patch?: {
    affection?: number;
    coins?: number;
    last_pet_tax_at?: string | null;
    last_owner_likeness_at?: string | null;
    owner_likeness?: number;
    pet_unlocked_at?: string | null;
    pet_score?: number;
    tribute_total?: number;
  };
  reason?: string;
};

type ProfileRow = {
  id: string;
  coins: number;
  affection: number;
  last_owner_likeness_at: string | null;
  last_pet_tax_at: string | null;
  owner_likeness: number;
  pet_unlocked_at: string | null;
  pet_score: number;
  tribute_total: number;
};

const allowedPetRewardReasons = new Set([
  "reward:pet-affection-claim",
  "reward:pet-case-opening",
  "reward:pet-confession",
  "reward:pet-evil-wait",
  "reward:pet-false-hope",
  "reward:pet-favor-roulette",
  "reward:pet-perfect-writing",
]);

function buildPetTransactionMetadata(reason: string, coinDelta: number) {
  return {
    reward: coinDelta,
    source: reason,
  };
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function numberFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function isPetTaskApprovedToday(row: {
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  status: string | null;
  task_id: string | null;
}) {
  if (row.task_id === "pet-affection-claim" || row.status !== "approved") {
    return false;
  }

  const today = getGmt3DateKey();
  const completedDate = row.completed_at ? getGmt3DateKey(row.completed_at) : null;
  const reviewedDate = row.reviewed_at ? getGmt3DateKey(row.reviewed_at) : null;
  const taskDate =
    metadataString(row.metadata, "date") ??
    metadataString(row.metadata, "completedDate") ??
    null;

  return completedDate === today || reviewedDate === today || taskDate === today;
}

function validatePatch(
  current: ProfileRow,
  patch: NonNullable<Body["patch"]>,
  reason: string,
  metadata: Record<string, unknown>,
) {
  const nextCoins = typeof patch.coins === "number" ? patch.coins : current.coins;
  const nextAffection = typeof patch.affection === "number" ? patch.affection : current.affection;
  const nextOwnerLikeness = typeof patch.owner_likeness === "number" ? patch.owner_likeness : current.owner_likeness;
  const nextPetScore = typeof patch.pet_score === "number" ? patch.pet_score : current.pet_score;
  const nextTributeTotal = typeof patch.tribute_total === "number"
    ? patch.tribute_total
    : current.tribute_total;
  const coinDelta = nextCoins - current.coins;
  const petScoreDelta = nextPetScore - current.pet_score;
  const tributeDelta = nextTributeTotal - current.tribute_total;

  if (
    !Number.isInteger(nextCoins) ||
    !Number.isInteger(nextAffection) ||
    !Number.isInteger(nextOwnerLikeness) ||
    !Number.isInteger(nextPetScore) ||
    nextAffection < 0 ||
    nextAffection > 100 ||
    nextOwnerLikeness < 0 ||
    nextOwnerLikeness > 100 ||
    nextPetScore < 0 ||
    nextPetScore > 1000
  ) {
    return "Invalid Pet profile values.";
  }

  if (reason === "pet:unlock") {
    if (
      current.pet_unlocked_at ||
      current.affection < 100 ||
      nextOwnerLikeness !== 100 ||
      nextAffection !== current.affection ||
      coinDelta !== 0 ||
      petScoreDelta !== 0 ||
      tributeDelta !== 0 ||
      typeof patch.pet_unlocked_at !== "string" ||
      typeof patch.last_owner_likeness_at !== "string" ||
      typeof patch.last_pet_tax_at !== "string"
    ) {
      return "Pet unlock patch is invalid.";
    }

    return null;
  }

  if (reason === "pet:maintenance") {
    if (coinDelta !== 0 || petScoreDelta !== 0 || tributeDelta !== 0) {
      return "Pet maintenance cannot change coins, score, or tribute.";
    }

    if (Math.abs(nextOwnerLikeness - current.owner_likeness) > 25 && nextOwnerLikeness !== 100) {
      return "Pet maintenance owner likeness delta is invalid.";
    }

    if (current.affection - nextAffection > 30 || nextAffection > current.affection) {
      return "Pet maintenance affection delta is invalid.";
    }

    return null;
  }

  if (reason === "tribute:debt-contract") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount");

    if (!spendAmount || coinDelta !== -spendAmount || tributeDelta !== spendAmount) {
      return "Debt contract profile delta is invalid.";
    }

    return null;
  }

  if (reason === "spend:pet-weekly-tax") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount");
    const rewardCoins = numberFromMetadata(metadata, "rewardCoins");

    if (!spendAmount || typeof rewardCoins !== "number" || coinDelta !== rewardCoins - spendAmount || petScoreDelta !== 20) {
      return "Weekly tax profile delta is invalid.";
    }

    return null;
  }

  if (reason.startsWith("reward:pet-")) {
    const allowedCoinRewards = new Set([50, 100, 150, 200, 500, 750, 1000]);

    if (!allowedPetRewardReasons.has(reason)) {
      return "Unsupported Pet reward reason.";
    }

    if (
      reason === "reward:pet-case-opening" &&
      (!Number.isInteger(coinDelta) || coinDelta < 0 || coinDelta > 5000 || petScoreDelta !== 10 || tributeDelta !== 0)
    ) {
      return "Pet case profile delta is invalid.";
    }

    if (reason === "reward:pet-affection-claim" && (coinDelta !== 0 || petScoreDelta !== 10 || tributeDelta !== 0)) {
      return "Pet affection claim profile delta is invalid.";
    }

    if (
      reason !== "reward:pet-case-opening" &&
      reason !== "reward:pet-affection-claim" &&
      (!allowedCoinRewards.has(coinDelta) || petScoreDelta !== 10 || tributeDelta !== 0)
    ) {
      return "Pet reward profile delta is invalid.";
    }

    return null;
  }

  return `Unsupported Pet profile mutation reason: ${reason}`;
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
  const reason = body?.reason?.trim();
  const patch = body?.patch;
  const metadata = body?.metadata ?? {};

  if (!reason || !patch) {
    return jsonError("Invalid Pet profile patch payload.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: currentProfile, error: currentError } = await supabase
    .from("profiles")
    .select("id, coins, affection, pet_score, owner_likeness, pet_unlocked_at, tribute_total, last_pet_tax_at, last_owner_likeness_at")
    .eq("id", authData.user.id)
    .single();

  if (currentError || !currentProfile) {
    return jsonError(currentError?.message ?? "Profile not found.", 404);
  }

  const validationError = validatePatch(currentProfile as ProfileRow, patch, reason, metadata);

  if (validationError) {
    return jsonError(validationError, 422);
  }

  if (reason === "reward:pet-affection-claim") {
    const { data: petTasks, error: petTasksError } = await supabase
      .from("user_pet_tasks")
      .select("task_id, completed_at, status, reviewed_at, metadata")
      .eq("user_id", authData.user.id);

    if (petTasksError) {
      console.error("Pet milestone eligibility lookup failed", petTasksError);
      return jsonError("Pet milestone eligibility lookup failed.", 500);
    }

    const approvedTodayCount = ((petTasks ?? []) as Array<{
      completed_at: string | null;
      metadata: Record<string, unknown> | null;
      reviewed_at: string | null;
      status: string | null;
      task_id: string | null;
    }>).filter(isPetTaskApprovedToday).length;

    if (approvedTodayCount < 5) {
      return jsonError("Pet milestone requires 5 approved Pet tasks today.", 422);
    }
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .eq("coins", (currentProfile as ProfileRow).coins)
    .eq("affection", (currentProfile as ProfileRow).affection)
    .eq("owner_likeness", (currentProfile as ProfileRow).owner_likeness)
    .eq("pet_score", (currentProfile as ProfileRow).pet_score)
    .eq("tribute_total", (currentProfile as ProfileRow).tribute_total)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Pet profile update was stale or duplicated.", updateError ? 500 : 409);
  }

  const coinDelta = Number(updatedProfile.coins ?? 0) - Number((currentProfile as ProfileRow).coins ?? 0);

  if (coinDelta !== 0) {
    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: coinDelta,
      balance_after: updatedProfile.coins,
      balance_before: (currentProfile as ProfileRow).coins,
      metadata: buildPetTransactionMetadata(reason, coinDelta),
      reason,
      user_id: authData.user.id,
    });

    if (transactionError) {
      console.error("Pet profile transaction insert failed", transactionError);
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({
          affection: currentProfile.affection,
          coins: currentProfile.coins,
          last_owner_likeness_at: currentProfile.last_owner_likeness_at,
          last_pet_tax_at: currentProfile.last_pet_tax_at,
          owner_likeness: currentProfile.owner_likeness,
          pet_score: currentProfile.pet_score,
          pet_unlocked_at: currentProfile.pet_unlocked_at,
          tribute_total: currentProfile.tribute_total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authData.user.id);

      if (rollbackError) {
        console.error("Pet profile rollback failed", rollbackError);
      }

      return jsonError("Pet profile coin logging failed.", 500);
    }
  }

  return Response.json({ profile: updatedProfile });
}
