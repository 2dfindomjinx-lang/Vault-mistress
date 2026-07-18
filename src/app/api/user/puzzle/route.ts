import { randomUUID } from "node:crypto";
import {
  getPuzzlePreset,
  getPuzzlePresets,
  normalizePuzzleAspect,
  pickDailyPuzzleImages,
  PUZZLE_DAILY_IMAGE_COUNT,
  type PuzzleImagePoolItem,
} from "@/lib/puzzle";
import { profileSelect } from "@/lib/server-game-rules";
import { getGmt3DateKey, getNextGmt3Reset } from "@/lib/time";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

type PuzzleBody = {
  action?: "abandon" | "complete" | "hint" | "start" | "save-progress";
  aspect?: string;
  attemptId?: string;
  difficulty?: string;
  finalBoard?: number[];
  moveCount?: number;
  progressState?: unknown;
  solveSeconds?: number;
  sourceImageId?: string;
  sourceType?: string;
};

type ProfileRow = {
  coins: number;
  id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const PUZZLE_HINT_COIN_COST = 500;
let puzzleImageFileNamesPromise: Promise<string[]> | null = null;

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: jsonError(authError?.message ?? "Authentication required.", 401), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

function toTitleCaseFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getPuzzleImageFileNames() {
  puzzleImageFileNamesPromise ??= readdir(path.join(process.cwd(), "public", "puzzle"), { withFileTypes: true })
    .then((entries) => entries
      .filter((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name))
      .map((entry) => entry.name))
    .catch(() => [] as string[]);

  return puzzleImageFileNamesPromise;
}

async function getPuzzleImagePool(): Promise<PuzzleImagePoolItem[]> {
  const imageFileNames = await getPuzzleImageFileNames();

  return imageFileNames
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
    .map((fileName) => ({
      id: fileName,
      image: `/puzzle/${fileName}`,
      sourceType: "puzzle",
      tag: "Puzzle Pool",
      title: toTitleCaseFromFileName(fileName),
    }));
}

function isPuzzleProgressState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const state = value as { pieces?: unknown };
  return Array.isArray(state.pieces) && state.pieces.length <= 700;
}

function getFreeHintCount(pieceCount: number) {
  if (pieceCount <= 150) return 1;
  if (pieceCount <= 300) return 2;
  return 3;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();

  try {
    const [imagePool, completionsResult, activeAttemptResult] = await Promise.all([
      getPuzzleImagePool(),
      supabase
        .from("puzzle_completions")
        .select("source_image_id, source_type, difficulty, best_solve_seconds, best_move_count, completed_count, unassisted_completed, assisted_completed")
        .eq("user_id", authResult.userId!),
      supabase
        .from("puzzle_attempts")
        .select("*")
        .eq("user_id", authResult.userId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (completionsResult.error) {
      console.warn("[puzzle] completions lookup failed", completionsResult.error);
    }

    const dailyKey = getGmt3DateKey();
    const images = pickDailyPuzzleImages(imagePool, dailyKey);
    const activeAttempt = activeAttemptResult.data ?? null;
    const activeImage = activeAttempt
      ? imagePool.find((item) => item.id === activeAttempt.source_image_id && item.sourceType === activeAttempt.source_type) ?? null
      : null;

    return Response.json({
      activeAttempt,
      activeImage,
      completions: completionsResult.data ?? [],
      dailyKey,
      nextDailyResetAt: getNextGmt3Reset().toISOString(),
      poolCount: imagePool.length,
      images,
      imageCount: images.length,
      presets: {
        standard: getPuzzlePresets("standard"),
        vertical: getPuzzlePresets("vertical"),
      },
    });
  } catch (error) {
    console.error("[puzzle] pool load failed", error);
    return jsonError("Puzzle image pool could not be loaded.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;

  const body = (await request.json().catch(() => null)) as PuzzleBody | null;
  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;

  if (body?.action === "complete") {
    const moveCount = Math.max(0, Math.floor(Number(body.moveCount ?? 0)));
    const solveSeconds = Math.max(0, Math.floor(Number(body.solveSeconds ?? 0)));

    if (!body.attemptId || moveCount <= 0 || solveSeconds <= 0) {
      return jsonError("Invalid puzzle completion.", 422);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("puzzle_attempts")
      .select("*")
      .eq("id", body.attemptId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (attemptError || !attempt) {
      return jsonError("Active puzzle attempt not found.", 404);
    }

    const finalBoard = Array.isArray(body.finalBoard) ? body.finalBoard : [];
    const pieceCount = Number(attempt.piece_count ?? 0);
    const boardLooksSolved =
      finalBoard.length === pieceCount &&
      finalBoard.every((value, index) => Number(value) === index);

    if (!boardLooksSolved) {
      return jsonError("Puzzle board is not solved.", 422);
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("puzzle_attempts")
      .update({
        completed_at: completedAt,
        move_count: moveCount,
        progress_saved_at: completedAt,
        progress_state: null,
        solve_seconds: solveSeconds,
        status: "completed",
      })
      .eq("id", attempt.id)
      .eq("status", "active");

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    const { data: existingCompletion } = await supabase
      .from("puzzle_completions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_image_id", attempt.source_image_id)
      .eq("difficulty", attempt.difficulty)
      .maybeSingle();

    const completionRow = {
      assisted_completed: Boolean(existingCompletion?.assisted_completed) || Boolean(attempt.used_hints),
      best_move_count: Math.min(
        Number(existingCompletion?.best_move_count ?? moveCount),
        moveCount,
      ),
      best_solve_seconds: Math.min(
        Number(existingCompletion?.best_solve_seconds ?? solveSeconds),
        solveSeconds,
      ),
      completed_count: Number(existingCompletion?.completed_count ?? 0) + 1,
      difficulty: attempt.difficulty,
      first_completed_at: existingCompletion?.first_completed_at ?? completedAt,
      last_completed_at: completedAt,
      source_image_id: attempt.source_image_id,
      source_type: attempt.source_type,
      unassisted_completed: Boolean(existingCompletion?.unassisted_completed) || !attempt.used_hints,
      user_id: userId,
    };

    const { error: completionError } = await supabase
      .from("puzzle_completions")
      .upsert(completionRow, { onConflict: "user_id,source_image_id,difficulty" });

    if (completionError) {
      return jsonError(completionError.message, 500);
    }

    return Response.json({ attempt: { ...attempt, completed_at: completedAt, move_count: moveCount, solve_seconds: solveSeconds, status: "completed" } });
  }

  if (body?.action === "abandon") {
    if (!body.attemptId) {
      return jsonError("Invalid puzzle abandon payload.", 422);
    }

    const { data: attempt, error } = await supabase
      .from("puzzle_attempts")
      .update({ completed_at: new Date().toISOString(), status: "abandoned" })
      .eq("id", body.attemptId)
      .eq("user_id", userId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (error || !attempt) {
      return jsonError(error?.message ?? "Active puzzle attempt not found.", error ? 500 : 404);
    }

    return Response.json({ ok: true });
  }

  if (body?.action === "hint") {
    if (!body.attemptId) {
      return jsonError("Invalid puzzle hint payload.", 422);
    }

    const [attemptResult, profileResult] = await Promise.all([
      supabase
        .from("puzzle_attempts")
        .select("*")
        .eq("id", body.attemptId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase.from("profiles").select(profileSelect).eq("id", userId).single(),
    ]);

    if (attemptResult.error || !attemptResult.data) {
      return jsonError("Active puzzle attempt not found.", 404);
    }

    if (profileResult.error || !profileResult.data) {
      return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
    }

    const attempt = attemptResult.data;
    const usedHintCount = Math.max(0, Math.floor(Number(attempt.hint_count ?? 0)));
    const freeHintCount = getFreeHintCount(Number(attempt.piece_count ?? 0));
    const coinCost = usedHintCount < freeHintCount ? 0 : PUZZLE_HINT_COIN_COST;
    const profile = profileResult.data as ProfileRow;
    if ((profile.coins ?? 0) < coinCost) return jsonError("Not enough coins for a puzzle hint.", 402);

    const now = new Date().toISOString();
    const nextCoins = profile.coins - coinCost;
    const { data: updatedProfile, error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", profile.coins)
      .select(profileSelect)
      .maybeSingle();

    if (profileUpdateError || !updatedProfile) {
      return jsonError(profileUpdateError?.message ?? "Puzzle preview was stale.", profileUpdateError ? 500 : 409);
    }

    if (coinCost > 0) {
      const { error: transactionError } = await supabase
        .from("coin_transactions")
        .insert({
          amount: -coinCost,
          balance_after: nextCoins,
          balance_before: profile.coins,
          metadata: {
            attemptId: attempt.id,
            difficulty: attempt.difficulty,
            pieceCount: attempt.piece_count,
            spendAmount: coinCost,
          },
          reason: "spend:puzzle-hint",
          user_id: userId,
        });

      if (transactionError) {
        await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
        return jsonError("Puzzle hint spending could not be logged.", 500);
      }
    }

    const { error: hintUpdateError } = await supabase
      .from("puzzle_attempts")
      .update({ hint_count: usedHintCount + 1, used_hints: true })
      .eq("id", attempt.id)
      .eq("status", "active");
    if (hintUpdateError) return jsonError(hintUpdateError.message, 500);

    return Response.json({
      freeHintsRemaining: Math.max(0, freeHintCount - usedHintCount - 1),
      hintNumber: usedHintCount + 1,
      profile: coinCost > 0 ? updatedProfile : profile,
    });
  }

  if (body?.action === "save-progress") {
    const moveCount = Math.max(0, Math.floor(Number(body.moveCount ?? 0)));

    if (!body.attemptId || !isPuzzleProgressState(body.progressState)) {
      return jsonError("Invalid puzzle progress payload.", 422);
    }

    const { error: progressError } = await supabase
      .from("puzzle_attempts")
      .update({
        move_count: moveCount,
        progress_saved_at: new Date().toISOString(),
        progress_state: body.progressState,
      })
      .eq("id", body.attemptId)
      .eq("user_id", userId)
      .eq("status", "active");

    if (progressError) {
      return jsonError(progressError.message, 500);
    }

    return Response.json({ ok: true });
  }

  if (body?.action !== "start") {
    return jsonError("Invalid puzzle action.", 422);
  }

  const aspect = normalizePuzzleAspect(body.aspect);
  const preset = getPuzzlePreset(String(body.difficulty ?? ""), aspect);

  if (!preset || !body.sourceImageId || !body.sourceType) {
    return jsonError("Invalid puzzle start payload.", 422);
  }

  const [imagePool, profileResult] = await Promise.all([
    getPuzzleImagePool(),
    supabase.from("profiles").select(profileSelect).eq("id", userId).single(),
  ]);
  const dailyKey = getGmt3DateKey();
  const dailyImagePool = pickDailyPuzzleImages(imagePool, dailyKey, PUZZLE_DAILY_IMAGE_COUNT);
  const sourceImage = dailyImagePool.find((item) => item.id === body.sourceImageId && item.sourceType === body.sourceType);

  if (!sourceImage) {
    return jsonError("That image is not in today's puzzle selection.", 403);
  }

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  const profile = profileResult.data as ProfileRow;
  if ((profile.coins ?? 0) < preset.coinCost) {
    return jsonError("Not enough coins to start that puzzle.", 402);
  }

  const now = new Date().toISOString();
  const nextCoins = profile.coins - preset.coinCost;
  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", profile.coins)
    .select(profileSelect)
    .maybeSingle();

  if (profileUpdateError || !updatedProfile) {
    return jsonError(profileUpdateError?.message ?? "Puzzle start was stale.", profileUpdateError ? 500 : 409);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      amount: -preset.coinCost,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        difficulty: preset.difficulty,
        pieceCount: preset.cols * preset.rows,
        puzzleDailyKey: dailyKey,
        sourceImageId: sourceImage.id,
        sourceType: sourceImage.sourceType,
        spendAmount: preset.coinCost,
      },
      reason: "spend:puzzle",
      user_id: userId,
    })
    .select("id")
    .maybeSingle();

  if (transactionError || !transaction) {
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
    return jsonError("Puzzle spending could not be logged.", 500);
  }

  const attempt = {
    coin_cost: preset.coinCost,
    difficulty: preset.difficulty,
    grid_cols: preset.cols,
    grid_rows: preset.rows,
    piece_count: preset.cols * preset.rows,
    shuffle_seed: randomUUID(),
    source_image_id: sourceImage.id,
    source_type: sourceImage.sourceType,
    status: "active",
    user_id: userId,
  };
  const { data: createdAttempt, error: attemptError } = await supabase
    .from("puzzle_attempts")
    .insert(attempt)
    .select("*")
    .maybeSingle();

  if (attemptError || !createdAttempt) {
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
    await supabase.from("coin_transactions").delete().eq("id", transaction.id);
    return jsonError("Puzzle attempt could not be created.", 500);
  }

  return Response.json({
    attempt: createdAttempt,
    image: sourceImage,
    profile: updatedProfile,
  });
}
