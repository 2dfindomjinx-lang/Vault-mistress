import {
  getAllowedTaskRewards,
  getCosmeticPrice,
  getTitlePrice,
  profileSelect,
  visibleGalleryCosts,
  TIMEOUT_RISK_DAILY_SAFE_LIMIT,
} from "@/lib/server-game-rules";
import { IRL_TASK_WHEEL_COST } from "@/lib/irl-task-wheel";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCooldownUntil,
  getMetadataNumber,
  getMetadataString,
} from "@/lib/server-task-actions";

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

function buildTransactionMetadata(
  reason: string,
  metadata: Record<string, unknown>,
  current: ProfileRow,
  next: Required<Pick<ProfileRow, "coins" | "affection">> & Partial<Pick<ProfileRow, "tribute_total">>,
) {
  const coinDelta = next.coins - current.coins;

  if (reason === "tribute:coin-offer") {
    return {
      affectionGain: numberFromMetadata(metadata, "affectionGain"),
      prestigeSource: stringFromMetadata(metadata, "prestigeSource") ?? "tribute-panel",
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:gallery-unlock") {
    return {
      itemId: stringFromMetadata(metadata, "itemId"),
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:irl-task-wheel") {
    return {
      spendAmount: IRL_TASK_WHEEL_COST,
    };
  }

  if (reason === "spend:cosmetic") {
    return {
      cosmeticId: stringFromMetadata(metadata, "cosmeticId"),
      cosmeticType: stringFromMetadata(metadata, "cosmeticType"),
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:title") {
    return {
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
      titleId: stringFromMetadata(metadata, "titleId"),
    };
  }

  if (reason === "streak_bonus") {
    const taskId = stringFromMetadata(metadata, "taskId");

    return {
      rewardCoins: coinDelta,
      taskId,
    };
  }

  if (reason === "task:wait-obediently" || reason === "task:timeout-risk" || reason === "beg") {
    return {
      rewardCoins: coinDelta,
      taskId: reason === "beg" ? "beg" : reason.replace("task:", ""),
    };
  }

  if (reason === "tribute:sacrifice" || reason === "tribute:support" || reason === "tribute:coin-offer") {
    return {
      prestigeSource: stringFromMetadata(metadata, "prestigeSource") ?? "tribute-panel",
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  return {};
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
  const clientNext = body?.nextProfile ?? {};
  const metadata = body?.metadata ?? {};

  if (!reason) {
    return jsonError("Invalid profile progress payload.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: currentProfileData, error: currentError } = await supabase
    .from("profiles")
    .select("id, coins, affection, tribute_total")
    .eq("id", authData.user.id)
    .single();

  if (currentError || !currentProfileData) {
    console.error("[profile-progress] Supabase error reading current profile", {
      code: currentError?.code,
      message: currentError?.message,
      details: currentError?.details,
      hint: currentError?.hint,
      userId: authData.user.id,
      reason,
    });
    return jsonError(currentError?.message ?? "Profile not found.", 404);
  }

  const current = currentProfileData as ProfileRow;
  const now = new Date().toISOString();

  // Server computes all sensitive values. Client nextProfile is only a hint for proposed delta (validated strictly).
  let nextCoins = current.coins;
  let nextAffection = current.affection;
  let nextTribute = current.tribute_total ?? 0;

  // Fetch task state for cooldown/reward cap enforcement on reward reasons
  interface CooldownTaskRow {
    task_id: string;
    completed_at: string | null;
    claimed_at: string | null;
    metadata: Record<string, unknown> | null;
  }
  let cooldownRow: CooldownTaskRow | null = null;
  const isRewardReason =
    reason === "beg" ||
    reason === "reward:case-opening" ||
    reason.includes("timeout-risk") ||
    reason.includes("wait-obediently") ||
    reason.startsWith("reward:task:") ||
    reason === "streak_bonus";

  if (isRewardReason) {
    let taskIdForRow = reason === "beg" ? "beg" : reason.replace("task:", "").replace("reward:task:", "");
    if (reason === "streak_bonus") {
      taskIdForRow = stringFromMetadata(metadata, "taskId") ?? "streak-bonus-1";
    }
    const { data: row } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", taskIdForRow)
      .maybeSingle();
    cooldownRow = row;
  }

  // Compute authoritative deltas. Never apply raw client nextProfile values.
  if (reason === "tribute:coin-offer") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount") || 0;
    const affectionGain = numberFromMetadata(metadata, "affectionGain") || 0;
    const allowedTributes = new Set([250, 1000, 5000]);
    if (!allowedTributes.has(spendAmount) || current.coins < spendAmount) {
      return jsonError("Invalid or unaffordable tribute offer.", 422);
    }
    nextCoins = current.coins - spendAmount;
    nextTribute = (current.tribute_total ?? 0) + spendAmount;
    nextAffection = Math.min(100, current.affection + affectionGain);
  } else if (reason === "spend:gallery-unlock") {
    const itemId = stringFromMetadata(metadata, "itemId");
    const cost = itemId ? visibleGalleryCosts.get(itemId) || 0 : 0;
    if (!cost || current.coins < cost) {
      return jsonError("Invalid gallery unlock or insufficient funds.", 422);
    }
    nextCoins = current.coins - cost;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:irl-task-wheel") {
    if (current.coins < IRL_TASK_WHEEL_COST) {
      return jsonError("Insufficient funds for IRL task wheel.", 422);
    }
    nextCoins = current.coins - IRL_TASK_WHEEL_COST;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:cosmetic") {
    const itemId = stringFromMetadata(metadata, "cosmeticId");
    const price = itemId ? getCosmeticPrice(itemId) || 0 : 0;
    if (!price || current.coins < price) {
      return jsonError("Invalid cosmetic or insufficient funds.", 422);
    }
    nextCoins = current.coins - price;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:title") {
    const titleId = stringFromMetadata(metadata, "titleId");
    const price = titleId ? getTitlePrice(titleId) || 0 : 0;
    if (!price || current.coins < price) {
      return jsonError("Invalid title or insufficient funds.", 422);
    }
    nextCoins = current.coins - price;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "tribute:sacrifice" || reason === "tribute:support") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount") || 0;
    if (!spendAmount || current.coins < spendAmount) {
      return jsonError("Invalid tribute spend or insufficient funds.", 422);
    }
    nextCoins = current.coins - spendAmount;
    nextTribute = (current.tribute_total ?? 0) + spendAmount;
    nextAffection = current.affection;
  } else if (isRewardReason) {
    // Reward mechanics: validate proposed delta against allow-list + enforce server DB cooldown/caps
    let taskId =
      reason === "beg"
        ? "beg"
        : reason === "reward:case-opening"
          ? "case-opening"
          : reason.replace("task:", "").replace("reward:task:", "");
    if (reason === "streak_bonus") {
      taskId = stringFromMetadata(metadata, "taskId") ?? "";
    }
    const allowed = getAllowedTaskRewards(taskId);
    const proposedDelta = (typeof clientNext.coins === "number" ? clientNext.coins : current.coins) - current.coins;

    if (!allowed.includes(proposedDelta)) {
      return jsonError("Reward delta not allowed for this action.", 422);
    }

    if (taskId !== "case-opening" && !cooldownRow) {
      return jsonError("Task state missing for reward action.", 409);
    }

    // Enforce cooldown / daily caps from trusted task row (sanitized by generic tasks route)
    const cooldownMetadata = cooldownRow?.metadata ?? null;
    const lastAction =
      taskId === "case-opening"
        ? null
        : getMetadataString(cooldownMetadata, "lastBegAt")
          || getMetadataString(cooldownMetadata, "resetAt")
          || getMetadataString(cooldownMetadata, "lastClaimAt")
          || cooldownRow?.claimed_at
          || cooldownRow?.completed_at;

    let cooldownMs = 60 * 1000; // beg default
    if (taskId === "timeout-risk" || taskId.includes("wait")) cooldownMs = 24 * 60 * 60 * 1000;

    const activeCooldown = taskId === "case-opening" ? null : getCooldownUntil(lastAction, cooldownMs);
    if (activeCooldown && proposedDelta > 0) {
      return jsonError("Action is on cooldown or daily limit reached.", 422);
    }

    // Additional daily cap for timeout-risk safe rewards
    if (taskId === "timeout-risk") {
      const safeWins = getMetadataNumber(cooldownMetadata, "safeWins", 0);
      if (safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT) {
        return jsonError("Daily safe reward limit reached for timeout-risk.", 422);
      }
    }

    nextCoins = current.coins + proposedDelta;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else {
    // All supported reasons are handled in the explicit server-computed branches above.
    // Unknown or unsupported reasons must be rejected immediately.
    // Do not construct or apply any values derived from client-provided nextProfile.
    return jsonError(`Unsupported profile mutation reason: ${reason}`, 422);
  }

  // Final safety clamps (only reached for explicitly supported reasons)
  if (nextAffection < 0 || nextAffection > 100 || !Number.isInteger(nextCoins) || !Number.isInteger(nextAffection)) {
    return jsonError("Computed profile values out of range.", 422);
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      affection: nextAffection,
      coins: nextCoins,
      ...(nextTribute !== (current.tribute_total ?? 0) ? { tribute_total: nextTribute } : {}),
      updated_at: now,
    })
    .eq("id", authData.user.id)
    .eq("coins", current.coins)
    .eq("affection", current.affection)
    .eq("tribute_total", current.tribute_total ?? 0)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    console.error("[profile-progress] Supabase error updating profile", {
      code: updateError?.code,
      message: updateError?.message,
      details: updateError?.details,
      hint: updateError?.hint,
      userId: authData.user.id,
      reason,
      computedNext: { nextCoins, nextAffection, nextTribute },
    });
    return jsonError(updateError?.message ?? "Profile update was stale or duplicated.", updateError ? 500 : 409);
  }

  const actualCoinDelta = Number(updatedProfile.coins ?? 0) - Number(current.coins ?? 0);

  if (actualCoinDelta !== 0) {
    const txMetadata = buildTransactionMetadata(reason, metadata, current, {
      affection: nextAffection,
      coins: nextCoins,
      ...(nextTribute !== (current.tribute_total ?? 0) ? { tribute_total: nextTribute } : {}),
    });

    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: actualCoinDelta,
      balance_after: updatedProfile.coins,
      balance_before: current.coins,
      metadata: txMetadata,
      reason,
      user_id: authData.user.id,
    });

    if (transactionError) {
      console.error("[profile-progress] Supabase error inserting coin transaction", {
        code: transactionError.code,
        message: transactionError.message,
        details: transactionError.details,
        hint: transactionError.hint,
        userId: authData.user.id,
        reason,
        actualCoinDelta,
      });
      // Rollback
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({
          affection: current.affection,
          coins: current.coins,
          ...(current.tribute_total != null ? { tribute_total: current.tribute_total } : {}),
          updated_at: now,
        })
        .eq("id", authData.user.id);
      if (rollbackError) {
        console.error("[profile-progress] Profile rollback after tx error failed", {
          code: rollbackError.code,
          message: rollbackError.message,
          userId: authData.user.id,
          reason,
        });
      }
      return jsonError("Profile progress coin logging failed.", 500);
    }
  }

  // Side-effects for task state ONLY after reward (profile + tx) has succeeded.
  // This guarantees: on any profile/tx failure above, no completed_at/claimed_at is written for reward tasks.
  // Server time + authoritative; prevents client backdating and bypass.
  if (isRewardReason) {
    let taskIdForSide = reason === "beg" ? "beg" : reason.replace("task:", "").replace("reward:task:", "");
    if (reason === "streak_bonus") {
      taskIdForSide = stringFromMetadata(metadata, "taskId") ?? "";
    }
    if (taskIdForSide === "beg" || taskIdForSide === "timeout-risk" || taskIdForSide === "wait-obediently") {
      const metaUpdate: Record<string, unknown> = { ...(cooldownRow?.metadata ?? {}) };
      if (taskIdForSide === "beg") {
        metaUpdate.lastBegAt = now;
        metaUpdate.lastReward = actualCoinDelta;
      }
      if (taskIdForSide === "timeout-risk") {
        const currentSafe = getMetadataNumber(cooldownRow?.metadata, "safeWins", 0);
        metaUpdate.safeWins = currentSafe + 1;
        if (!getMetadataString(cooldownRow?.metadata, "resetAt")) {
          metaUpdate.resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
        metaUpdate.lastResult = "safe";
      }
      if (taskIdForSide === "wait-obediently") {
        metaUpdate.status = "completed";
        // cooldownUntil will be derived from claimed_at in buildTasksFromRows
      }
      const { error: sideErr } = await supabase
        .from("user_tasks")
        .upsert(
          {
            user_id: authData.user.id,
            task_id: taskIdForSide,
            completed_at: now,
            claimed_at: now,
            reward_coins: actualCoinDelta,
            metadata: metaUpdate,
          },
          { onConflict: "user_id,task_id" },
        );
      if (sideErr) {
        console.error("[profile-progress] Side task row update (post-reward) failed", {
          code: sideErr.code,
          message: sideErr.message,
          details: sideErr.details,
          hint: sideErr.hint,
          userId: authData.user.id,
          reason,
          taskId: taskIdForSide,
        });
      }
    }
  }

  return Response.json({ profile: updatedProfile });
}
