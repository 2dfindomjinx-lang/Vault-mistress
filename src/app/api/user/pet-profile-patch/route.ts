import { getAllowedTaskRewards, profileSelect } from "@/lib/server-game-rules";
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
  const rewardPetScoreDelta = Math.max(0, Math.min(10, 1000 - current.pet_score));

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
    const weeklyTaxPetScoreDelta = Math.max(
      0,
      Math.min(PET_WEEKLY_TAX_REWARD, 1000 - current.pet_score),
    );

    if (
      !spendAmount ||
      typeof rewardCoins !== "number" ||
      coinDelta !== rewardCoins - spendAmount ||
      petScoreDelta !== weeklyTaxPetScoreDelta
    ) {
      return "Weekly tax profile delta is invalid.";
    }

    return null;
  }

  if (reason.startsWith("reward:pet-")) {
    // Use server-game-rules allowed list (includes event multipliers: 0, base, 1.5x, 2x) instead of limited hardcoded set.
    // This prevents over-restriction after hardening while still validating against known possible deltas for pet coin rewards (mostly base-50 evented).
    const petCoinAllowed = getAllowedTaskRewards("beg"); // beg uses base 50 like most pet task coin rewards

    if (
      reason === "reward:pet-case-opening" &&
      (!Number.isInteger(coinDelta) ||
        coinDelta < 0 ||
        coinDelta > 5000 ||
        petScoreDelta !== rewardPetScoreDelta ||
        tributeDelta !== 0)
    ) {
      return "Pet case profile delta is invalid.";
    }

    if (
      reason === "reward:pet-affection-claim" &&
      (coinDelta !== 0 || petScoreDelta !== rewardPetScoreDelta || tributeDelta !== 0)
    ) {
      return "Pet affection claim profile delta is invalid.";
    }

    if (
      reason !== "reward:pet-case-opening" &&
      reason !== "reward:pet-affection-claim" &&
      (!petCoinAllowed.includes(coinDelta) || petScoreDelta !== rewardPetScoreDelta || tributeDelta !== 0)
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
    console.error("[pet-profile-patch] Supabase error reading current profile", {
      code: currentError?.code,
      message: currentError?.message,
      details: currentError?.details,
      hint: currentError?.hint,
      userId: authData.user.id,
      reason,
    });
    return jsonError(currentError?.message ?? "Profile not found.", 404);
  }

  const validationError = validatePatch(currentProfile as ProfileRow, patch, reason, metadata);

  if (validationError) {
    return jsonError(validationError, 422);
  }

  const now = new Date().toISOString();

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
    console.error("[pet-profile-patch] Supabase error updating pet profile", {
      code: updateError?.code,
      message: updateError?.message,
      details: updateError?.details,
      hint: updateError?.hint,
      userId: authData.user.id,
      reason,
      patch,
    });
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
      console.error("[pet-profile-patch] Supabase error inserting coin transaction", {
        code: transactionError.code,
        message: transactionError.message,
        details: transactionError.details,
        hint: transactionError.hint,
        userId: authData.user.id,
        reason,
        coinDelta,
      });
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
        console.error("[pet-profile-patch] Pet profile rollback failed after tx error", {
          code: rollbackError.code,
          message: rollbackError.message,
          userId: authData.user.id,
          reason,
        });
      }

      return jsonError("Pet profile coin logging failed.", 500);
    }
  }

  // Side-effect: mark the corresponding pet task approved/completed ONLY after reward grant + tx succeeded.
  // This ensures pet task progress (for reward cases) is not recorded unless coins/pet_score were granted.
  // Client may still call persistPetTask after (for count/meta), but side guarantees the record on reward path.
  if (reason.startsWith("reward:pet-")) {
    const taskId = reason.replace("reward:", ""); // e.g. "pet-perfect-writing"
    const isAffectionClaim = reason === "reward:pet-affection-claim";
    const isCase = reason === "reward:pet-case-opening";
    const rewardScore = isAffectionClaim ? 10 : 10; // most are 10; tax separate but not via reward:pet- coin path
    const meta: Record<string, unknown> = { ...( (body?.metadata as Record<string, unknown>) ?? {}) };
    if (isAffectionClaim || isCase) {
      meta.date = new Date().toISOString().slice(0, 10);
    }
    const { error: sidePetErr } = await supabase
      .from("user_pet_tasks")
      .upsert(
        {
          user_id: authData.user.id,
          task_id: taskId,
          completed_at: now,
          reviewed_at: now,
          reward_score: rewardScore,
          status: "approved",
          metadata: meta,
        },
        { onConflict: "user_id,task_id" },
      );
    if (sidePetErr) {
      console.error("[pet-profile-patch] Side pet task mark (post-reward) failed", {
        code: sidePetErr.code,
        message: sidePetErr.message,
        details: sidePetErr.details,
        hint: sidePetErr.hint,
        userId: authData.user.id,
        reason,
        taskId,
      });
    }
  }

  return Response.json({ profile: updatedProfile });
}
