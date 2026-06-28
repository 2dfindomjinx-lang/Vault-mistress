import { profileSelect } from "@/lib/server-game-rules";
import { awardDevotion, DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import {
  generateNumberPickOptions,
  getActiveEventMultipliers,
  getDailyResetCooldownUntil,
  getMetadataNumber,
  getMetadataNumberArray,
  randomFrom,
  type UserTaskActionRow,
  validateNumberPickOptions,
} from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  options?: number[];
  selectedNumber?: number;
};

type ProfileRow = {
  affection: number;
  coins: number;
  id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
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
  const selectedNumber = body?.selectedNumber;

  if (typeof selectedNumber !== "number" || !Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 9) {
    console.error("[number-pick] invalid payload", {
      selectedNumber,
      userId: authData.user.id,
    });
    return jsonError("Invalid Number Pick payload.");
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult, multipliers] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, coins, affection")
      .eq("id", authData.user.id)
      .single(),
    supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", "number-pick")
      .maybeSingle(),
    getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("[number-pick] profile read failed", {
      error: profileResult.error,
      userId: authData.user.id,
    });
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    console.error("[number-pick] task read failed", {
      error: taskResult.error,
      userId: authData.user.id,
    });
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const existingTask = (taskResult.data as UserTaskActionRow | null) ?? null;
  const cooldownUntil = getDailyResetCooldownUntil(existingTask?.claimed_at);
  const metadata =
    existingTask?.claimed_at && !cooldownUntil
      ? {}
      : existingTask?.metadata ?? {};

  if (cooldownUntil) {
    return jsonError("Number Pick is still on cooldown.", 429);
  }

  const storedOptions = validateNumberPickOptions(metadata.options);
  const submittedOptions = validateNumberPickOptions(body?.options);
  const options = storedOptions && storedOptions.length === 3
    ? storedOptions
    : submittedOptions ?? generateNumberPickOptions();

  if (!options.includes(selectedNumber)) {
    console.error("[number-pick] selected number missing from active options", {
      options,
      selectedNumber,
      submittedOptions,
      userId: authData.user.id,
    });
    return jsonError("Selected number is not in the active options.", 422);
  }

  const previousWrongSelections = getMetadataNumberArray(metadata, "wrongSelections") ?? [];

  if (previousWrongSelections.includes(selectedNumber)) {
    return jsonError("That number was already rejected.", 422);
  }

  const existingResult = metadata.result;

  if (existingResult === "win" || existingResult === "loss") {
    return jsonError("Number Pick is already completed.", 422);
  }

  const existingCorrect = getMetadataNumber(metadata, "correct", Number.NaN);
  const correctNumber = Number.isFinite(existingCorrect) && options.includes(existingCorrect)
    ? existingCorrect
    : randomFrom(options);
  const attemptsRemaining = getMetadataNumber(metadata, "attemptsRemaining", 1);
  const isCorrect = selectedNumber === correctNumber;
  const baseReward = isCorrect ? 100 : 0;
  const reward = baseReward > 0 ? Math.round(baseReward * multipliers.task_reward_multiplier) : 0;
  const nextAttemptsRemaining = isCorrect ? 0 : Math.max(0, attemptsRemaining - 1);
  const finalAttempt = isCorrect || nextAttemptsRemaining === 0;
  const result: "win" | "loss" | null = finalAttempt ? (isCorrect ? "win" : "loss") : null;
  const wrongSelections = isCorrect
    ? previousWrongSelections
    : Array.from(new Set([...previousWrongSelections, selectedNumber]));
  const now = new Date().toISOString();
  const nextCoins = profile.coins + reward;

  let updatedProfile = profileResult.data;

  if (reward > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        updated_at: now,
      })
      .eq("id", authData.user.id)
      .eq("coins", profile.coins)
      .select(profileSelect)
      .maybeSingle();

    if (error || !data) {
      console.error("[number-pick] Supabase error updating profile for coin change", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        nextCoins,
        previousCoins: profile.coins,
        reward,
        userId: authData.user.id,
      });
      return jsonError(error?.message ?? "Number Pick duplicate or stale balance rejected.", 409);
    }

    updatedProfile = data;
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", authData.user.id)
      .single();

    if (error || !data) {
      console.error("[number-pick] profile refresh failed", {
        error,
        userId: authData.user.id,
      });
      return jsonError(error?.message ?? "Profile refresh failed.", 500);
    }

    updatedProfile = data;
  }

  const nextMetadata = {
    ...metadata,
    attemptsRemaining: nextAttemptsRemaining,
    correct: correctNumber,
    options,
    result,
    selected: selectedNumber,
    wrongSelections,
  };

  let transactionId: string | null = null;
  if (reward > 0) {
    const transactionPayload = {
      amount: reward,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        attemptsRemaining,
        correct: correctNumber,
        options,
        selected: selectedNumber,
      },
      reason: "task:number-pick",
      user_id: authData.user.id,
    };
    const { data: transaction, error: transactionError } = await supabase
      .from("coin_transactions")
      .insert(transactionPayload)
      .select("id")
      .single();

    if (transactionError || !transaction) {
      console.error("[number-pick] Supabase error inserting coin transaction", {
        code: transactionError?.code,
        message: transactionError?.message,
        details: transactionError?.details,
        hint: transactionError?.hint,
        userId: authData.user.id,
        transactionPayload,
      });
      const { error: rollbackProfileError } = await supabase
        .from("profiles")
        .update({
          coins: profile.coins,
          updated_at: now,
        })
        .eq("id", authData.user.id)
        .eq("coins", nextCoins);

      if (rollbackProfileError) {
        console.error("[number-pick] profile rollback failed after transaction failure", rollbackProfileError);
      }

      return jsonError("Number Pick could not be saved. Please try again.", 500);
    }

    transactionId = transaction.id;
  }

  const { data: updatedTask, error: taskError } = await supabase
    .from("user_tasks")
    .upsert(
      {
        user_id: authData.user.id,
        task_id: "number-pick",
        completed_at: finalAttempt ? now : existingTask?.completed_at ?? null,
        claimed_at: finalAttempt ? now : null,
        reward_coins: reward,
        metadata: nextMetadata,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (taskError || !updatedTask) {
    console.error("[number-pick] user_tasks upsert failed", {
      error: taskError,
      nextMetadata,
      reward,
      transactionId,
      userId: authData.user.id,
    });

    if (transactionId) {
      const { error: transactionCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .eq("id", transactionId);

      if (transactionCleanupError) {
        console.error("[number-pick] transaction cleanup failed after task failure", transactionCleanupError);
      }
    }

    if (reward > 0) {
      const { error: rollbackProfileError } = await supabase
        .from("profiles")
        .update({
          coins: profile.coins,
          updated_at: now,
        })
        .eq("id", authData.user.id)
        .eq("coins", nextCoins);

      if (rollbackProfileError) {
        console.error("[number-pick] profile rollback failed after task failure", rollbackProfileError);
      }
    }

    if (existingTask) {
      const { error: rollbackTaskError } = await supabase
        .from("user_tasks")
        .upsert(
          {
            claimed_at: existingTask.claimed_at,
            completed_at: existingTask.completed_at,
            metadata: existingTask.metadata ?? {},
            reward_coins: existingTask.reward_coins,
            task_id: "number-pick",
            user_id: authData.user.id,
          },
          { onConflict: "user_id,task_id" },
        );

      if (rollbackTaskError) {
        console.error("[number-pick] task rollback failed", rollbackTaskError);
      }
    } else {
      const { error: rollbackTaskError } = await supabase
        .from("user_tasks")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("task_id", "number-pick");

      if (rollbackTaskError) {
        console.error("[number-pick] task delete rollback failed", rollbackTaskError);
      }
    }

    return jsonError("Number Pick could not be saved. Please try again.", 500);
  }

  if (reward > 0 && result === "win") {
    try {
      await awardDevotion(supabase, {
        amount: DEVOTION_REWARD_BASIC_TASK,
        metadata: {
          options,
          reward,
          selectedNumber,
          taskId: "number-pick",
        },
        source: "task_action",
        sourceKey: `number-pick:${updatedTask.claimed_at ?? now}`,
        userId: authData.user.id,
      });
    } catch (devotionError) {
      console.error("[number-pick] devotion award failed", {
        devotionError,
        userId: authData.user.id,
      });
    }
  }

  return Response.json({
    profile: updatedProfile,
    task: updatedTask,
    taskState: {
      claimed: finalAttempt,
      completed: result === "win",
      cooldownUntil: finalAttempt ? getDailyResetCooldownUntil(now) : null,
      numberPickAttemptsRemaining: nextAttemptsRemaining,
      numberPickCorrect: correctNumber,
      numberPickOptions: options,
      numberPickResult: result,
      numberPickSelected: selectedNumber,
      numberPickWrongSelections: wrongSelections,
    },
  });
}
