import { readdir } from "node:fs/promises";
import path from "node:path";
import { awardDevotion } from "@/lib/devotion";
import { profileSelect } from "@/lib/server-game-rules";
import {
  buildShrineStatus,
  getShrineDevotionReward,
  isShrinePurchaseAmount,
  resolveShrineMemories,
} from "@/lib/shrine";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  amount?: number;
};

type CoinTransactionRow = {
  amount: number | null;
  metadata?: Record<string, unknown> | null;
  user_id?: string | null;
};

type ProfileRow = {
  affection: number;
  coins: number;
  id: string;
  total_devotion?: number | null;
  tribute_total: number;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getShrineImageFileNames() {
  const shrineDir = path.join(process.cwd(), "public", "shrine");

  try {
    const entries = await readdir(shrineDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name))
      .map((entry) => entry.name);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException | null;

    if (nodeError?.code !== "ENOENT") {
      console.error("[shrine] image directory read failed", error);
    }

    return [] as string[];
  }
}

function getShrineSpendTotal(rows: CoinTransactionRow[]) {
  return rows.reduce((sum, row) => {
    const metadataSpend = row.metadata?.spendAmount;
    const resolvedSpend = typeof metadataSpend === "number" && Number.isFinite(metadataSpend)
      ? metadataSpend
      : Math.abs(Number(row.amount ?? 0));

    return sum + Math.max(0, Math.floor(resolvedSpend));
  }, 0);
}

async function getTopShrineWorshippers(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: transactions, error: transactionError } = await supabase
    .from("coin_transactions")
    .select("user_id, amount, metadata")
    .eq("reason", "tribute:shrine");

  if (transactionError) {
    console.warn("[shrine] top worshipper transaction lookup failed", transactionError);
    return [];
  }

  const totals = new Map<string, number>();

  ((transactions ?? []) as CoinTransactionRow[]).forEach((transaction) => {
    if (!transaction.user_id) {
      return;
    }

    totals.set(
      transaction.user_id,
      (totals.get(transaction.user_id) ?? 0) + getShrineSpendTotal([transaction]),
    );
  });

  const topEntries = Array.from(totals.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 5);

  if (topEntries.length === 0) {
    return [];
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", topEntries.map(([userId]) => userId));

  if (profileError) {
    console.warn("[shrine] top worshipper profile lookup failed", profileError);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

  return topEntries.map(([userId, totalSpent]) => {
    const profile = profileMap.get(userId);

    return {
      displayName: typeof profile?.display_name === "string" ? profile.display_name : null,
      totalSpent,
      userId,
      username: typeof profile?.username === "string" ? profile.username : "Unknown",
    };
  });
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      error: jsonError(authError?.message ?? "Authentication required.", 401),
      userId: null,
    };
  }

  return {
    error: null,
    userId: authData.user.id,
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();

  if (authResult.error) {
    return authResult.error;
  }

  if (!authResult.userId) {
    return jsonError("Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: transactions, error: transactionError }, imageFileNames, topWorshippers] = await Promise.all([
    supabase
      .from("coin_transactions")
      .select("amount, metadata")
      .eq("user_id", authResult.userId)
      .eq("reason", "tribute:shrine"),
    getShrineImageFileNames(),
    getTopShrineWorshippers(supabase),
  ]);

  if (transactionError) {
    console.error("[shrine] spend history lookup failed", transactionError);
    return jsonError("Shrine progress could not be loaded.", 500);
  }

  const shrine = buildShrineStatus(
    getShrineSpendTotal((transactions ?? []) as CoinTransactionRow[]),
    resolveShrineMemories(imageFileNames),
  );

  return Response.json({
    shrine: {
      ...shrine,
      topWorshippers,
    },
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId();

  if (authResult.error) {
    return authResult.error;
  }

  if (!authResult.userId) {
    return jsonError("Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const amount = Number(body?.amount ?? 0);

  if (!isShrinePurchaseAmount(amount)) {
    return jsonError("Invalid shrine purchase amount.", 422);
  }
  const devotionReward = getShrineDevotionReward(amount);

  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId;
  const now = new Date().toISOString();

  const [{ data: profile, error: profileError }, { data: previousShrineTransactions, error: shrineHistoryError }, imageFileNames, topWorshippers] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", userId)
        .single(),
      supabase
        .from("coin_transactions")
        .select("amount, metadata")
        .eq("user_id", userId)
        .eq("reason", "tribute:shrine"),
      getShrineImageFileNames(),
      getTopShrineWorshippers(supabase),
    ]);

  if (profileError || !profile) {
    console.error("[shrine] profile lookup failed", profileError);
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  if (shrineHistoryError) {
    console.error("[shrine] shrine history lookup failed", shrineHistoryError);
    return jsonError("Shrine history could not be loaded.", 500);
  }

  const currentProfile = profile as ProfileRow;

  if ((currentProfile.affection ?? 0) < 100) {
    return jsonError("Shrine unlocks only after affection reaches 100.", 422);
  }

  if ((currentProfile.coins ?? 0) < amount) {
    return jsonError("Not enough coins for that shrine offering.", 402);
  }

  const shrineMemories = resolveShrineMemories(imageFileNames);
  const previousShrineSpent = getShrineSpendTotal((previousShrineTransactions ?? []) as CoinTransactionRow[]);
  const nextCoins = currentProfile.coins - amount;
  const nextTributeTotal = (currentProfile.tribute_total ?? 0) + amount;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      tribute_total: nextTributeTotal,
      updated_at: now,
    })
    .eq("id", userId)
    .eq("coins", currentProfile.coins)
    .eq("tribute_total", currentProfile.tribute_total ?? 0)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    console.error("[shrine] profile update failed", updateError);
    return jsonError(updateError?.message ?? "Shrine purchase was stale.", updateError ? 500 : 409);
  }

  const nextShrineSpent = previousShrineSpent + amount;
  let shrineStatus = {
    ...buildShrineStatus(nextShrineSpent, shrineMemories),
    topWorshippers,
  };
  const previousUnlockedCount = buildShrineStatus(previousShrineSpent, shrineMemories).unlockedImageCount;

  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      amount: -amount,
      balance_after: nextCoins,
      balance_before: currentProfile.coins,
      metadata: {
        devotionAmount: devotionReward,
        prestigeSource: "shrine",
        shrineImageUnlocked: shrineStatus.unlockedImageCount > previousUnlockedCount,
        shrineTotalSpentAfter: nextShrineSpent,
        spendAmount: amount,
      },
      reason: "tribute:shrine",
      user_id: userId,
    })
    .select("id")
    .maybeSingle();

  if (transactionError || !transaction) {
    console.error("[shrine] transaction insert failed", transactionError);
    await supabase
      .from("profiles")
      .update({
        coins: currentProfile.coins,
        tribute_total: currentProfile.tribute_total ?? 0,
        updated_at: now,
      })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Shrine purchase logging failed.", 500);
  }

  try {
    await awardDevotion(supabase, {
      amount: devotionReward,
      metadata: {
        devotionAmount: devotionReward,
        shrineTotalSpentAfter: nextShrineSpent,
        spendAmount: amount,
      },
      source: "shrine_purchase",
      sourceKey: `shrine:${userId}:${transaction.id}`,
      userId,
    });
  } catch (devotionError) {
    console.error("[shrine] devotion award failed", devotionError);
  }

  shrineStatus = {
    ...shrineStatus,
    topWorshippers: await getTopShrineWorshippers(supabase),
  };

  const { data: refreshedProfile, error: refreshedProfileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (refreshedProfileError || !refreshedProfile) {
    console.error("[shrine] refreshed profile lookup failed", refreshedProfileError);
    return Response.json({
      profile: updatedProfile,
      shrine: shrineStatus,
    });
  }

  return Response.json({
    profile: refreshedProfile,
    shrine: shrineStatus,
  });
}
