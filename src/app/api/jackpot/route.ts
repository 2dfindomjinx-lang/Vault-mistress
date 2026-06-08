import {
  JACKPOT_BASE_POOL,
  JACKPOT_MIN_CONTRIBUTION,
  getJackpotCycle,
  type LoyaltyJackpotState,
} from "@/lib/jackpot";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";

type JackpotRow = {
  id: string;
  cycle_key: string;
  starts_at: string;
  contribution_ends_at: string;
  ends_at: string;
  base_pool: number;
  winner_user_id: string | null;
  winner_username: string | null;
  winner_amount: number | null;
  winner_selected_at: string | null;
  skipped_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string;
  coins: number;
  loyalty_streak: number | null;
};

type ContributionRow = {
  user_id?: string;
  username: string;
  amount: number;
  created_at: string;
};

type JackpotWinnerTransactionRow = {
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
const jackpotWinReasons = ["jackpot_win_1st", "jackpot_win_2nd", "jackpot_win_3rd"];
const jackpotWinnerPlaces = {
  jackpot_win_1st: 1,
  jackpot_win_2nd: 2,
  jackpot_win_3rd: 3,
} as const;

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();

  if (error) {
    console.error("Jackpot auth lookup failed", error);
  }

  return data.user?.id ?? null;
}

async function ensureCurrentJackpot(supabase: SupabaseAdminClient) {
  const cycle = getJackpotCycle();
  const { data: existing, error: existingError } = await supabase
    .from("loyalty_jackpots")
    .select("*")
    .eq("cycle_key", cycle.cycleKey)
    .maybeSingle();

  if (existingError) {
    console.error("Jackpot lookup failed", existingError);
    throw existingError;
  }

  if (existing) {
    return { cycle, jackpot: existing as JackpotRow };
  }

  const { data: created, error: createError } = await supabase
    .from("loyalty_jackpots")
    .insert({
      cycle_key: cycle.cycleKey,
      starts_at: cycle.startsAt,
      contribution_ends_at: cycle.contributionEndsAt,
      ends_at: cycle.endsAt,
      base_pool: JACKPOT_BASE_POOL,
    })
    .select("*")
    .single();

  if (createError) {
    console.error("Jackpot create failed", createError);
    throw createError;
  }

  return { cycle, jackpot: created as JackpotRow };
}

type ExcludableQuery<T> = {
  not: (column: string, operator: string, value: string) => T;
};

function withWinnerExclusion<T extends ExcludableQuery<T>>(query: T, winnerIds: string[]) {
  if (winnerIds.length === 0) {
    return query;
  }

  return query.not("id", "in", `(${winnerIds.join(",")})`);
}

async function getPreviousWinnerIds(supabase: SupabaseAdminClient, currentCycleKey: string) {
  const { data: previousJackpots, error } = await supabase
    .from("loyalty_jackpots")
    .select("id, winner_user_id")
    .neq("cycle_key", currentCycleKey)
    .order("starts_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("Previous jackpot winners lookup failed", error);
    return [];
  }

  const legacyWinnerIds = (previousJackpots ?? [])
    .map((row) => String(row.winner_user_id ?? ""))
    .filter(Boolean);
  const jackpotIds = (previousJackpots ?? []).map((row) => String(row.id ?? "")).filter(Boolean);

  if (jackpotIds.length === 0) {
    return legacyWinnerIds;
  }

  const { data: winnerTransactions, error: transactionError } = await supabase
    .from("coin_transactions")
    .select("user_id, reason, metadata")
    .in("reason", jackpotWinReasons);

  if (transactionError) {
    console.error("Previous jackpot winner transaction lookup failed", transactionError);
    return legacyWinnerIds;
  }

  const transactionWinnerIds = ((winnerTransactions ?? []) as Array<{ user_id: string; metadata: Record<string, unknown> | null }>)
    .filter((row) => jackpotIds.includes(String(row.metadata?.jackpotId ?? "")))
    .map((row) => row.user_id)
    .filter(Boolean);

  return Array.from(new Set([...legacyWinnerIds, ...transactionWinnerIds]));
}

async function getEligibleCount(
  supabase: SupabaseAdminClient,
  excludedWinnerIds: string[],
) {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("loyalty_streak", 3);

  query = withWinnerExclusion(query, excludedWinnerIds);
  const { count, error } = await query;

  if (error) {
    console.error("Jackpot eligible count failed", error);
    return 0;
  }

  return count ?? 0;
}

async function getRandomEligibleProfile(
  supabase: SupabaseAdminClient,
  excludedWinnerIds: string[],
  eligibleCount: number,
) {
  if (eligibleCount <= 0) {
    return null;
  }

  const index = Math.floor(Math.random() * eligibleCount);
  let query = supabase
    .from("profiles")
    .select("id, username, coins, loyalty_streak")
    .gte("loyalty_streak", 3)
    .order("id", { ascending: true })
    .range(index, index);

  query = withWinnerExclusion(query, excludedWinnerIds);
  const { data, error } = await query;

  if (error) {
    console.error("Jackpot winner candidate lookup failed", error);
    throw error;
  }

  return (data?.[0] ?? null) as ProfileRow | null;
}

function getPayoutPercentages(winnerCount: number) {
  if (winnerCount >= 3) {
    return [55, 30, 15];
  }

  if (winnerCount === 2) {
    return [65, 35];
  }

  if (winnerCount === 1) {
    return [100];
  }

  return [];
}

function getPayoutAmounts(pool: number, winnerCount: number) {
  const percentages = getPayoutPercentages(winnerCount);
  let distributed = 0;

  return percentages.map((percentage, index) => {
    if (index === percentages.length - 1) {
      return Math.max(0, pool - distributed);
    }

    const amount = Math.floor((pool * percentage) / 100);
    distributed += amount;
    return amount;
  });
}

async function getRandomEligibleProfiles(
  supabase: SupabaseAdminClient,
  excludedWinnerIds: string[],
  maxWinners: number,
) {
  const winners: ProfileRow[] = [];
  const excludedIds = new Set(excludedWinnerIds);

  while (winners.length < maxWinners) {
    const eligibleCount = await getEligibleCount(supabase, Array.from(excludedIds));
    const winner = await getRandomEligibleProfile(supabase, Array.from(excludedIds), eligibleCount);

    if (!winner) {
      break;
    }

    winners.push(winner);
    excludedIds.add(winner.id);
  }

  return winners;
}

async function getContributionTotal(supabase: SupabaseAdminClient, jackpotId: string) {
  const { data, error } = await supabase
    .from("loyalty_jackpot_contributions")
    .select("amount")
    .eq("jackpot_id", jackpotId);

  if (error) {
    console.error("Jackpot contribution total lookup failed", error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

async function getJackpotWinnersFromTransactions(
  supabase: SupabaseAdminClient,
  jackpotId: string,
) {
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("user_id, amount, reason, created_at, metadata")
    .in("reason", jackpotWinReasons);

  if (error) {
    console.error("Jackpot winner transaction display lookup failed", error);
    return [];
  }

  const rows = ((data ?? []) as JackpotWinnerTransactionRow[])
    .filter((row) => String(row.metadata?.jackpotId ?? "") === jackpotId)
    .sort((a, b) => {
      const aPlace = jackpotWinnerPlaces[a.reason as keyof typeof jackpotWinnerPlaces] ?? 99;
      const bPlace = jackpotWinnerPlaces[b.reason as keyof typeof jackpotWinnerPlaces] ?? 99;
      return aPlace - bPlace;
    });

  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError) {
    console.error("Jackpot winner profile display lookup failed", profileError);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));
  const usernameStyles = await getUsernameStylesForUserIds(supabase, userIds);

  return rows.map((row) => ({
    username: profileMap.get(row.user_id) ?? String(row.metadata?.username ?? "@unknown"),
    amount: Number(row.amount ?? 0),
    selectedAt: row.created_at,
    place: jackpotWinnerPlaces[row.reason as keyof typeof jackpotWinnerPlaces],
    usernameStyle: usernameStyles.get(row.user_id),
  }));
}

async function getUsernameStylesForUserIds(
  supabase: SupabaseAdminClient,
  userIds: string[],
) {
  const { data, error } = await supabase
    .from("user_cosmetics")
    .select("user_id, item_id, item_type, equipped")
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("equipped", true)
    .in("item_type", ["username-color", "username-glow"]);

  if (error) {
    console.error("Jackpot username cosmetic lookup failed", error);
    return new Map();
  }

  return getUsernameStylesByUserId((data ?? []) as EquippedUsernameCosmeticRow[]);
}

async function maybeSelectWinner(
  supabase: SupabaseAdminClient,
  jackpot: JackpotRow,
  phase: string,
  pool: number,
) {
  if (phase !== "winner" || jackpot.winner_selected_at || jackpot.skipped_at) {
    return jackpot;
  }

  const previousWinnerIds = await getPreviousWinnerIds(supabase, jackpot.cycle_key);
  const winners = await getRandomEligibleProfiles(supabase, previousWinnerIds, 3);
  const now = new Date().toISOString();

  if (winners.length === 0) {
    const { data, error } = await supabase
      .from("loyalty_jackpots")
      .update({ skipped_at: now, updated_at: now })
      .eq("id", jackpot.id)
      .select("*")
      .single();

    if (error) {
      console.error("Jackpot skip update failed", error);
      throw error;
    }

    return data as JackpotRow;
  }

  const payoutAmounts = getPayoutAmounts(pool, winners.length);
  const transactionRows: Array<{
    user_id: string;
    amount: number;
    reason: string;
    balance_before: number;
    balance_after: number;
    metadata: Record<string, unknown>;
  }> = [];

  for (const [index, winner] of winners.entries()) {
    const amount = payoutAmounts[index] ?? 0;
    const place = (index + 1) as 1 | 2 | 3;
    const nextCoins = Number(winner.coins ?? 0) + amount;
    const { data: updatedWinner, error: profileError } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: now })
      .eq("id", winner.id)
      .eq("coins", Number(winner.coins ?? 0))
      .select("id")
      .maybeSingle();

    if (profileError || !updatedWinner) {
      console.error("Jackpot winner profile reward failed", profileError);
      throw profileError ?? new Error("Jackpot winner balance was stale.");
    }

    transactionRows.push({
      user_id: winner.id,
      amount,
      reason: jackpotWinReasons[index],
      balance_before: Number(winner.coins ?? 0),
      balance_after: nextCoins,
      metadata: {
        jackpotId: jackpot.id,
        cycleKey: jackpot.cycle_key,
        place,
        username: winner.username,
        tributeTotalChanged: false,
      },
    });
  }

  const { data: insertedTransactions, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert(transactionRows)
    .select("id, user_id");

  if (transactionError) {
    console.error("Jackpot reward transactions failed", transactionError);
    for (const winner of winners) {
      const originalCoins = Number(winner.coins ?? 0);
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({ coins: originalCoins, updated_at: now })
        .eq("id", winner.id)
        .eq("coins", originalCoins + (payoutAmounts[winners.indexOf(winner)] ?? 0));

      if (rollbackError) {
        console.error("Jackpot winner rollback failed", rollbackError);
      }
    }

    throw transactionError;
  }

  const firstWinner = winners[0];
  const firstAmount = payoutAmounts[0] ?? pool;
  const { data, error } = await supabase
    .from("loyalty_jackpots")
    .update({
      winner_user_id: firstWinner.id,
      winner_username: firstWinner.username,
      winner_amount: firstAmount,
      winner_selected_at: now,
      updated_at: now,
    })
    .eq("id", jackpot.id)
    .select("*")
    .single();

  if (error) {
    console.error("Jackpot winner update failed", error);
    if (insertedTransactions?.length) {
      const { error: cleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .in("id", insertedTransactions.map((row) => row.id));

      if (cleanupError) {
        console.error("Jackpot winner transaction cleanup failed", cleanupError);
      }
    }

    for (const [index, winner] of winners.entries()) {
      const rollbackAmount = payoutAmounts[index] ?? 0;
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({ coins: Number(winner.coins ?? 0), updated_at: now })
        .eq("id", winner.id)
        .eq("coins", Number(winner.coins ?? 0) + rollbackAmount);

      if (rollbackError) {
        console.error("Jackpot winner profile cleanup failed", rollbackError);
      }
    }

    throw error;
  }

  return data as JackpotRow;
}

async function buildJackpotState(
  supabase: SupabaseAdminClient,
  jackpot: JackpotRow,
  userId: string | null,
): Promise<LoyaltyJackpotState> {
  const now = new Date();
  const contributionEndsAt = new Date(jackpot.contribution_ends_at).getTime();
  const rawPhase = now.getTime() < contributionEndsAt ? "contribution" : "winner";
  const phase = rawPhase === "winner" && (jackpot.winner_selected_at || jackpot.skipped_at)
    ? "preparing"
    : rawPhase;
  const contributionTotal = await getContributionTotal(supabase, jackpot.id);
  const pool = Number(jackpot.base_pool ?? JACKPOT_BASE_POOL) + contributionTotal;
  const previousWinnerIds = await getPreviousWinnerIds(supabase, jackpot.cycle_key);
  const eligibleCount = await getEligibleCount(supabase, previousWinnerIds);

  const { data: contributionRows, error: contributionError } = await supabase
    .from("loyalty_jackpot_contributions")
    .select("user_id, username, amount, created_at")
    .eq("jackpot_id", jackpot.id)
    .order("created_at", { ascending: false });

  if (contributionError) {
    console.error("Jackpot recent contributors lookup failed", contributionError);
  }

  const allContributorRows = await supabase
    .from("loyalty_jackpot_contributions")
    .select("user_id, amount")
    .eq("jackpot_id", jackpot.id);

  if (allContributorRows.error) {
    console.error("Jackpot participant lookup failed", allContributorRows.error);
  }

  const participantCount = new Set(
    (allContributorRows.data ?? []).map((row) => String(row.user_id ?? "")),
  ).size;
  const userContributionTotal = userId
    ? (allContributorRows.data ?? [])
        .filter((row) => row.user_id === userId)
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    : 0;

  let userEligible = false;
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loyalty_streak")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Jackpot user eligibility lookup failed", profileError);
    }

    userEligible =
      Number(profile?.loyalty_streak ?? 0) >= 3 && !previousWinnerIds.includes(userId);
  }

  const currentWinners = await getJackpotWinnersFromTransactions(supabase, jackpot.id);
  const displayCurrentWinners =
    currentWinners.length > 0
      ? currentWinners
      : jackpot.winner_selected_at && jackpot.winner_username
        ? [{
            username: jackpot.winner_username,
            amount: Number(jackpot.winner_amount ?? pool),
            selectedAt: jackpot.winner_selected_at,
            place: 1 as const,
          }]
        : [];

  const { data: previousJackpots, error: previousWinnerError } = await supabase
    .from("loyalty_jackpots")
    .select("id, winner_username, winner_amount, winner_selected_at")
    .not("winner_user_id", "is", null)
    .neq("cycle_key", jackpot.cycle_key)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (previousWinnerError) {
    console.error("Previous jackpot winner display lookup failed", previousWinnerError);
  }

  const previousWinnerRows = await Promise.all(
    ((previousJackpots ?? []) as JackpotRow[]).map(async (previousJackpot) => {
      const winners = await getJackpotWinnersFromTransactions(supabase, previousJackpot.id);

      if (winners.length > 0) {
        return winners;
      }

      return previousJackpot.winner_selected_at && previousJackpot.winner_username
        ? [{
            username: previousJackpot.winner_username,
            amount: Number(previousJackpot.winner_amount ?? 0),
            selectedAt: previousJackpot.winner_selected_at,
            place: 1 as const,
          }]
        : [];
    }),
  );
  const displayPreviousWinners = previousWinnerRows.flat();
  const previousWinnerRow = displayPreviousWinners[0];
  const contributorUserIds = Array.from(
    new Set(((contributionRows ?? []) as ContributionRow[]).map((row) => String(row.user_id ?? "")).filter(Boolean)),
  );
  const contributorUsernameStyles = await getUsernameStylesForUserIds(supabase, contributorUserIds);

  return {
    id: jackpot.id,
    cycleKey: jackpot.cycle_key,
    phase,
    phaseEndsAt: phase === "contribution" ? jackpot.contribution_ends_at : jackpot.ends_at,
    startsAt: jackpot.starts_at,
    contributionEndsAt: jackpot.contribution_ends_at,
    endsAt: jackpot.ends_at,
    basePool: Number(jackpot.base_pool ?? JACKPOT_BASE_POOL),
    pool,
    eligibleCount,
    participantCount,
    userContributionTotal,
    userEligible,
    userProtected: Boolean(userId && previousWinnerIds.includes(userId)),
    recentContributors: ((contributionRows ?? []) as ContributionRow[]).map((row) => ({
      username: row.username,
      amount: row.amount,
      createdAt: row.created_at,
      usernameStyle: row.user_id ? contributorUsernameStyles.get(row.user_id) : undefined,
    })),
    currentWinners: displayCurrentWinners,
    currentWinner: displayCurrentWinners[0] ?? null,
    previousWinners: displayPreviousWinners,
    previousWinner: previousWinnerRow ?? null,
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Jackpot route is not configured", configErrors);
    return jsonError(`Jackpot is not configured: ${configErrors.join(", ")}`);
  }

  try {
    const userId = await getAuthedUserId();
    const supabase = createSupabaseAdminClient();
    const { cycle, jackpot } = await ensureCurrentJackpot(supabase);
    const contributionTotal = await getContributionTotal(supabase, jackpot.id);
    const pool = Number(jackpot.base_pool ?? JACKPOT_BASE_POOL) + contributionTotal;
    const updatedJackpot = await maybeSelectWinner(supabase, jackpot, cycle.phase, pool);
    const state = await buildJackpotState(supabase, updatedJackpot, userId);

    return Response.json({ jackpot: state });
  } catch (error) {
    console.error("Jackpot GET failed", error);
    return jsonError(error instanceof Error ? error.message : "Jackpot lookup failed.");
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Jackpot contribution route is not configured", configErrors);
    return jsonError(`Jackpot is not configured: ${configErrors.join(", ")}`);
  }

  try {
    const userId = await getAuthedUserId();

    if (!userId) {
      return jsonError("Sign in required.", 401);
    }

    const body = (await request.json()) as { amount?: number };
    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount < JACKPOT_MIN_CONTRIBUTION) {
      return jsonError(
        `Contribution amount must be at least ${JACKPOT_MIN_CONTRIBUTION} coins.`,
        400,
      );
    }

    const supabase = createSupabaseAdminClient();
    const { cycle, jackpot } = await ensureCurrentJackpot(supabase);

    if (cycle.phase !== "contribution") {
      return jsonError("Jackpot contributions are closed for this cycle.", 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, coins")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Jackpot contributor profile lookup failed", profileError);
      throw profileError;
    }

    if (!profile) {
      return jsonError("Profile not found.", 404);
    }

    const currentCoins = Number(profile.coins ?? 0);

    if (currentCoins < amount) {
      return jsonError("Not enough Principessa Coins.", 400);
    }

    const nextCoins = currentCoins - amount;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: now })
      .eq("id", userId);

    if (updateError) {
      console.error("Jackpot contribution coin update failed", updateError);
      throw updateError;
    }

    const { data: contribution, error: contributionError } = await supabase
      .from("loyalty_jackpot_contributions")
      .insert({
        jackpot_id: jackpot.id,
        user_id: userId,
        username: profile.username,
        amount,
      })
      .select("id")
      .single();

    if (contributionError) {
      console.error("Jackpot contribution insert failed", contributionError);
      throw contributionError;
    }

    const { data: contributionTransaction, error: transactionError } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: userId,
        amount: -amount,
        reason: "jackpot_contribution",
        balance_before: currentCoins,
        balance_after: nextCoins,
        metadata: {
          jackpotId: jackpot.id,
          cycleKey: jackpot.cycle_key,
          tributeTotalChanged: false,
        },
      })
      .select("id")
      .single();

    if (transactionError) {
      console.error("Jackpot contribution transaction failed", transactionError);
      if (contribution?.id) {
        const { error: contributionCleanupError } = await supabase
          .from("loyalty_jackpot_contributions")
          .delete()
          .eq("id", contribution.id);

        if (contributionCleanupError) {
          console.error("Jackpot contribution cleanup failed", contributionCleanupError);
        }
      }

      const { error: profileRollbackError } = await supabase
        .from("profiles")
        .update({ coins: currentCoins, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("coins", nextCoins);

      if (profileRollbackError) {
        console.error("Jackpot contribution profile rollback failed", profileRollbackError);
      }

      return jsonError("Jackpot contribution logging failed.", 500);
    }

    try {
      const contributionTotal = await getContributionTotal(supabase, jackpot.id);
      const updatedJackpot = await maybeSelectWinner(
        supabase,
        jackpot,
        cycle.phase,
        Number(jackpot.base_pool ?? JACKPOT_BASE_POOL) + contributionTotal,
      );
      const state = await buildJackpotState(supabase, updatedJackpot, userId);

      return Response.json({ coins: nextCoins, jackpot: state });
    } catch (error) {
      console.error("Jackpot POST failed", error);
      if (contribution?.id) {
        const { error: contributionCleanupError } = await supabase
          .from("loyalty_jackpot_contributions")
          .delete()
          .eq("id", contribution.id);

        if (contributionCleanupError) {
          console.error("Jackpot contribution cleanup after state failure failed", contributionCleanupError);
        }
      }

      if (contributionTransaction?.id) {
        const { error: txCleanupError } = await supabase
          .from("coin_transactions")
          .delete()
          .eq("id", contributionTransaction.id);

        if (txCleanupError) {
          console.error("Jackpot contribution transaction cleanup after state failure failed", txCleanupError);
        }
      }

      const { error: profileRollbackError } = await supabase
        .from("profiles")
        .update({ coins: currentCoins, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("coins", nextCoins);

      if (profileRollbackError) {
        console.error("Jackpot contribution profile rollback after state failure failed", profileRollbackError);
      }

      return jsonError(error instanceof Error ? error.message : "Jackpot contribution failed.");
    }
  } catch (error) {
    console.error("Jackpot POST failed before completion", error);
    return jsonError(error instanceof Error ? error.message : "Jackpot contribution failed.");
  }
}
