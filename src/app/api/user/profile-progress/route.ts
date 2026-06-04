import {
  getAllowedTaskRewards,
  getCosmeticPrice,
  getTitlePrice,
  profileSelect,
  visibleGalleryCosts,
} from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type ProfilePatchBody = {
  metadata?: Record<string, unknown>;
  nextProfile?: {
    affection?: number;
    coins?: number;
    tribute_total?: number;
  };
  reason?: string;
};

type ProfileRow = {
  id: string;
  coins: number;
  affection: number;
  tribute_total: number;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function numberFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function validateTransition(
  current: ProfileRow,
  next: Required<Pick<ProfileRow, "coins" | "affection">> & Partial<Pick<ProfileRow, "tribute_total">>,
  reason: string,
  metadata: Record<string, unknown>,
) {
  const coinDelta = next.coins - current.coins;
  const tributeDelta = typeof next.tribute_total === "number"
    ? next.tribute_total - (current.tribute_total ?? 0)
    : 0;

  if (!Number.isInteger(next.coins) || !Number.isInteger(next.affection)) {
    return "Invalid profile values.";
  }

  if (next.affection < 0 || next.affection > 100) {
    return "Affection must stay between 0 and 100.";
  }

  if (reason === "tribute:coin-offer") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount");
    const affectionGain = numberFromMetadata(metadata, "affectionGain");
    const allowedTributes = new Set([250, 1000, 5000]);

    if (!spendAmount || !allowedTributes.has(spendAmount)) {
      return "Invalid tribute amount.";
    }

    if (coinDelta !== -spendAmount || tributeDelta !== spendAmount) {
      return "Tribute profile delta does not match the submitted amount.";
    }

    if (typeof affectionGain !== "number" || next.affection !== Math.min(100, current.affection + affectionGain)) {
      return "Tribute affection delta is invalid.";
    }

    return null;
  }

  if (reason === "spend:gallery-unlock") {
    const itemId = stringFromMetadata(metadata, "itemId");
    const expectedCost = itemId ? visibleGalleryCosts.get(itemId) : null;

    if (!expectedCost || coinDelta !== -expectedCost || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Gallery unlock delta is invalid.";
    }

    return null;
  }

  if (reason === "spend:irl-task-wheel") {
    if (coinDelta !== -2000 || tributeDelta !== 0 || next.affection !== current.affection) {
      return "IRL task wheel spend delta is invalid.";
    }

    return null;
  }

  if (reason === "spend:cosmetic") {
    const itemId = stringFromMetadata(metadata, "cosmeticId");
    const expectedPrice = itemId ? getCosmeticPrice(itemId) : null;

    if (!expectedPrice || coinDelta !== -expectedPrice || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Cosmetic spend delta is invalid.";
    }

    return null;
  }

  if (reason === "spend:title") {
    const titleId = stringFromMetadata(metadata, "titleId");
    const expectedPrice = titleId ? getTitlePrice(titleId) : null;

    if (!expectedPrice || coinDelta !== -expectedPrice || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Title spend delta is invalid.";
    }

    return null;
  }

  if (reason.startsWith("reward:task:")) {
    const taskId = reason.replace("reward:task:", "");

    if (!getAllowedTaskRewards(taskId).includes(coinDelta) || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Task reward delta is invalid.";
    }

    return null;
  }

  if (reason === "streak_bonus") {
    const taskId = stringFromMetadata(metadata, "taskId");

    if (!taskId || !getAllowedTaskRewards(taskId).includes(coinDelta) || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Streak reward delta is invalid.";
    }

    return null;
  }

  if (["task:wait-obediently", "task:timeout-risk", "beg"].includes(reason)) {
    const taskId = reason === "beg" ? "beg" : reason.replace("task:", "");

    if (!getAllowedTaskRewards(taskId).includes(coinDelta) || tributeDelta !== 0 || next.affection !== current.affection) {
      return "Task profile delta is invalid.";
    }

    return null;
  }

  if (reason === "tribute:sacrifice" || reason === "tribute:support" || reason === "tribute:coin-offer") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount");

    if (!spendAmount || coinDelta !== -spendAmount || tributeDelta !== spendAmount) {
      return "Tribute spend delta is invalid.";
    }

    return null;
  }

  return `Unsupported profile mutation reason: ${reason}`;
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

  const body = (await request.json().catch(() => null)) as ProfilePatchBody | null;
  const reason = body?.reason?.trim();
  const nextProfile = body?.nextProfile;
  const metadata = body?.metadata ?? {};

  if (!reason || typeof nextProfile?.coins !== "number" || typeof nextProfile.affection !== "number") {
    return jsonError("Invalid profile progress payload.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: currentProfile, error: currentError } = await supabase
    .from("profiles")
    .select("id, coins, affection, tribute_total")
    .eq("id", authData.user.id)
    .single();

  if (currentError || !currentProfile) {
    return jsonError(currentError?.message ?? "Profile not found.", 404);
  }

  const validationError = validateTransition(currentProfile as ProfileRow, {
    affection: nextProfile.affection,
    coins: nextProfile.coins,
    ...(typeof nextProfile.tribute_total === "number" ? { tribute_total: nextProfile.tribute_total } : {}),
  }, reason, metadata);

  if (validationError) {
    return jsonError(validationError, 422);
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      affection: nextProfile.affection,
      coins: nextProfile.coins,
      ...(typeof nextProfile.tribute_total === "number" ? { tribute_total: nextProfile.tribute_total } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .select(profileSelect)
    .single();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Profile update failed.", 500);
  }

  const coinDelta = Number(updatedProfile.coins ?? 0) - Number((currentProfile as ProfileRow).coins ?? 0);

  if (coinDelta !== 0) {
    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: coinDelta,
      balance_after: updatedProfile.coins,
      balance_before: (currentProfile as ProfileRow).coins,
      metadata: {
        ...metadata,
        tributeTotalChanged: typeof nextProfile.tribute_total === "number",
      },
      reason,
      user_id: authData.user.id,
    });

    if (transactionError) {
      console.error("Profile progress transaction insert failed", transactionError);
    }
  }

  return Response.json({ profile: updatedProfile });
}
