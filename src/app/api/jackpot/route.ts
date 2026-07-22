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
import {
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  is_admin: boolean | null;
  loyalty_streak: number | null;
  last_loyalty_at?: string | null;
};

type ContributionRow = {
  user_id?: string;
  username: string;
  amount: number;
  created_at: string;
};

type ProfileSnippetRow = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SupabaseReadClient = SupabaseClient;
const jackpotWinReasons = ["jackpot_win_1st", "jackpot_win_2nd", "jackpot_win_3rd"];
const jackpotSelect =
  "id, cycle_key, starts_at, contribution_ends_at, ends_at, base_pool, winner_user_id, winner_username, winner_amount, winner_selected_at, skipped_at";

const VAULT_CHECK_TIMEOUT_MS = 25000; // 25s to prevent stuck "checking vault" on slow/failed DB ops
const STREAK_EXPIRY_MS = 48 * 60 * 60 * 1000;

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function normalizeUsernameLookup(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function hasActiveLoyaltyStreak(
  loyaltyStreak: number | null | undefined,
  lastLoyaltyAt: string | null | undefined,
) {
  if ((loyaltyStreak ?? 0) < 3 || !lastLoyaltyAt) {
    return false;
  }

  const lastLoyaltyMs = new Date(lastLoyaltyAt).getTime();
  if (!Number.isFinite(lastLoyaltyMs)) {
    return false;
  }

  return Date.now() - lastLoyaltyMs <= STREAK_EXPIRY_MS;
}

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();

  if (error) {
    console.error("Jackpot auth lookup failed", error);
  }

  return data.user?.id ?? null;
}

export async function ensureCurrentJackpot(supabase: SupabaseAdminClient) {
  const cycle = getJackpotCycle();
  const lookupPromise = supabase
    .from("loyalty_jackpots")
    .select(jackpotSelect)
    .eq("cycle_key", cycle.cycleKey)
    .maybeSingle();

  const { data: existing, error: existingError } = await withTimeout(
    lookupPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "ensureCurrentJackpot lookup",
  ).catch((e) => {
    console.error("Jackpot ensure lookup timed out or failed", e);
    throw e;
  });

  if (existingError) {
    console.error("Jackpot lookup failed", existingError);
    throw existingError;
  }

  if (existing) {
    return { cycle, jackpot: existing as JackpotRow };
  }

  const insertPromise = supabase
    .from("loyalty_jackpots")
    .insert({
      cycle_key: cycle.cycleKey,
      starts_at: cycle.startsAt,
      contribution_ends_at: cycle.contributionEndsAt,
      ends_at: cycle.endsAt,
      base_pool: JACKPOT_BASE_POOL,
    })
    .select(jackpotSelect)
    .single();

  const { data: created, error: createError } = await withTimeout(
    insertPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "ensureCurrentJackpot create",
  ).catch((e) => {
    console.error("Jackpot ensure create timed out or failed", e);
    throw e;
  });

  if (createError) {
    console.error("Jackpot create failed", createError);
    throw createError;
  }

  return { cycle, jackpot: created as JackpotRow };
}

export async function getCurrentJackpot(supabase: SupabaseReadClient) {
  const cycle = getJackpotCycle();
  const queryPromise = supabase
    .from("loyalty_jackpots")
    .select(jackpotSelect)
    .eq("cycle_key", cycle.cycleKey)
    .maybeSingle();

  const { data, error } = await withTimeout(
    queryPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getCurrentJackpot",
  ).catch((e) => {
    console.error("Current jackpot lookup timed out or failed", e);
    throw e;
  });

  if (error) {
    console.error("Current jackpot lookup failed", error);
    throw error;
  }

  return { cycle, jackpot: (data as JackpotRow | null) ?? null };
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

async function getPreviousWinnerIds(supabase: SupabaseReadClient, currentCycleKey: string) {
  const rpcPromise = supabase.rpc("get_previous_jackpot_winner_user_ids", {
    p_current_cycle_key: currentCycleKey,
  });
  const { data, error } = await withTimeout(
    rpcPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getPreviousWinnerIds",
  ).catch((e) => {
    console.error("Previous jackpot winners lookup timed out or failed", e);
    return { data: null, error: null };
  });

  if (error) {
    console.error("Previous jackpot winners lookup failed", error);
    return [];
  }

  return Array.isArray(data) ? data.map((value) => String(value)) : [];
}

async function getEligibleCount(
  supabase: SupabaseAdminClient,
  excludedWinnerIds: string[],
) {
  const activeSince = new Date(Date.now() - STREAK_EXPIRY_MS).toISOString();
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", false)
    .gte("loyalty_streak", 3)
    .gte("last_loyalty_at", activeSince);

  query = withWinnerExclusion(query, excludedWinnerIds);
  const queryPromise = query;
  const { count, error } = await withTimeout(
    queryPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getEligibleCount",
  ).catch((e) => {
    console.error("Jackpot eligible count timed out or failed (vault check)", e);
    return { count: 0, error: null };
  });

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
  const activeSince = new Date(Date.now() - STREAK_EXPIRY_MS).toISOString();
  let query = supabase
    .from("profiles")
    .select("id, username, coins, is_admin, loyalty_streak, last_loyalty_at")
    .eq("is_admin", false)
    .gte("loyalty_streak", 3)
    .gte("last_loyalty_at", activeSince)
    .order("id", { ascending: true })
    .range(index, index);

  query = withWinnerExclusion(query, excludedWinnerIds);
  const queryPromise = query;
  const { data, error } = await withTimeout(
    queryPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getRandomEligibleProfile",
  ).catch((e) => {
    console.error("Jackpot winner candidate lookup timed out or failed (vault check)", e);
    return { data: null, error: null };
  });

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

export async function getContributionTotal(supabase: SupabaseReadClient, jackpotId: string) {
  const { data: summary, error: summaryError } = await supabase.rpc("get_jackpot_contribution_summary", {
    p_jackpot_id: jackpotId,
    p_user_id: null,
  });

  if (!summaryError && summary && typeof summary === "object" && !Array.isArray(summary)) {
    return Number((summary as { contributionTotal?: number }).contributionTotal ?? 0);
  }

  const queryPromise = supabase
    .from("loyalty_jackpot_contributions")
    .select("amount")
    .eq("jackpot_id", jackpotId);

  const { data, error } = await withTimeout(
    queryPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getContributionTotal",
  ).catch((e) => {
    console.error("Jackpot contribution total lookup timed out or failed (vault check)", e);
    return { data: [], error: null };
  });

  if (error) {
    console.error("Jackpot contribution total lookup failed", error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

async function getContributionSummary(
  supabase: SupabaseReadClient,
  jackpotId: string,
  userId: string | null,
) {
  const { data, error } = await supabase.rpc("get_jackpot_contribution_summary", {
    p_jackpot_id: jackpotId,
    p_user_id: userId,
  });

  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    const summary = data as {
      contributionTotal?: number;
      participantCount?: number;
      userContributionTotal?: number;
    };
    return {
      contributionTotal: Number(summary.contributionTotal ?? 0),
      participantCount: Number(summary.participantCount ?? 0),
      userContributionTotal: Number(summary.userContributionTotal ?? 0),
    };
  }

  const { data: rows, error: rowsError } = await supabase
    .from("loyalty_jackpot_contributions")
    .select("user_id, amount")
    .eq("jackpot_id", jackpotId);
  if (rowsError) throw rowsError;

  const contributionRows = rows ?? [];
  return {
    contributionTotal: contributionRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    participantCount: new Set(contributionRows.map((row) => String(row.user_id ?? ""))).size,
    userContributionTotal: userId
      ? contributionRows
          .filter((row) => row.user_id === userId)
          .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
      : 0,
  };
}

async function getJackpotWinnersFromTransactions(supabase: SupabaseReadClient, jackpotId: string) {
  const rpcPromise = supabase.rpc("get_jackpot_winner_display", {
    p_jackpot_id: jackpotId,
  });
  const { data, error } = await withTimeout(
    rpcPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getJackpotWinnersFromTransactions",
  ).catch((e) => {
    console.error("Jackpot winner transaction display lookup timed out or failed", e);
    return { data: null, error: null };
  });

  if (error) {
    console.error("Jackpot winner transaction display lookup failed", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    username: string;
    amount: number;
    reason: string;
    created_at: string;
    place: number;
  }>;
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const { data: profileSnippets, error: profileError } = await withTimeout(
    supabase.rpc("get_public_profile_snippets", { p_user_ids: userIds.length > 0 ? userIds : [] }).then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getJackpotWinnersFromTransactions profiles",
  ).catch((e) => {
    console.error("Jackpot winner profile lookup timed out or failed", e);
    return { data: null, error: null };
  });

  if (profileError) {
    console.error("Jackpot winner profile lookup failed", profileError);
  }

  const profileMap = new Map(
    ((profileSnippets ?? []) as ProfileSnippetRow[]).map((profile) => [profile.id, profile]),
  );
  const profileByUsernameMap = new Map(
    ((profileSnippets ?? []) as ProfileSnippetRow[]).map((profile) => [
      normalizeUsernameLookup(profile.username),
      profile,
    ]),
  );
  const usernameStyles = await getUsernameStylesForUserIds(supabase, userIds);

  return rows.map((row) => ({
    ...(() => {
      const resolvedProfile =
        profileMap.get(row.user_id) ??
        profileByUsernameMap.get(normalizeUsernameLookup(row.username)) ??
        null;

        return {
          username: resolvedProfile?.username ?? row.username,
          rawUsername: resolvedProfile?.username ?? row.username,
          displayName: resolvedProfile?.display_name ?? null,
          display_name: resolvedProfile?.display_name ?? null,
          usernameStyle: row.user_id ? usernameStyles.get(row.user_id) : undefined,
        };
      })(),
    amount: Number(row.amount ?? 0),
    selectedAt: row.created_at,
    place: row.place as 1 | 2 | 3,
  }));
}

async function getUsernameStylesForUserIds(
  supabase: SupabaseReadClient,
  userIds: string[],
) {
  const rpcPromise = supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });
  const { data, error } = await withTimeout(
    rpcPromise.then((r) => r),
    VAULT_CHECK_TIMEOUT_MS,
    "getUsernameStylesForUserIds",
  ).catch((e) => {
    console.error("Jackpot username cosmetic lookup timed out or failed", e);
    return { data: null, error: null };
  });

  if (error) {
    console.error("Jackpot username cosmetic lookup failed", error);
    return new Map();
  }

  return getUsernameStylesByUserId((data ?? []) as EquippedUsernameCosmeticRow[]);
}

export async function maybeSelectWinner(
  supabase: SupabaseAdminClient,
  jackpot: JackpotRow,
  phase: string,
  pool: number,
) {
  if (phase !== "winner" || jackpot.winner_selected_at || jackpot.skipped_at) {
    return jackpot;
  }

  const nowIso = new Date().toISOString();

  try {
    const previousWinnerIds = await getPreviousWinnerIds(supabase, jackpot.cycle_key);
    const winners = await withTimeout(
      getRandomEligibleProfiles(supabase, previousWinnerIds, 3),
      VAULT_CHECK_TIMEOUT_MS,
      "maybeSelectWinner:getRandomEligibleProfiles (vault check)",
    );

    if (winners.length === 0) {
      const { data, error } = await supabase
        .from("loyalty_jackpots")
        .update({ skipped_at: nowIso, updated_at: nowIso })
        .eq("id", jackpot.id)
        .select(jackpotSelect)
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
        .update({ coins: nextCoins, updated_at: nowIso })
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
          .update({ coins: originalCoins, updated_at: nowIso })
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
        winner_selected_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", jackpot.id)
      .select(jackpotSelect)
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
          .update({ coins: Number(winner.coins ?? 0), updated_at: nowIso })
          .eq("id", winner.id)
          .eq("coins", Number(winner.coins ?? 0) + rollbackAmount);

        if (rollbackError) {
          console.error("Jackpot winner profile cleanup failed", rollbackError);
        }
      }

      throw error;
    }

    return data as JackpotRow;
  } catch (selectionError) {
    // Vault check (eligible profiles, RPCs, contrib etc) or reward tx failed.
    // Force skip so the cycle can transition out of "winner" into "preparing" and not stay locked.
    // Future cron/advance runs will still ensure next cycles.
    console.error("Jackpot winner selection failed (vault check or tx error), forcing skip for recovery", selectionError);
    try {
      const { data: skipped } = await supabase
        .from("loyalty_jackpots")
        .update({ skipped_at: nowIso, updated_at: nowIso })
        .eq("id", jackpot.id)
        .select(jackpotSelect)
        .maybeSingle();
      if (skipped) {
        return skipped as JackpotRow;
      }
    } catch (skipErr) {
      console.error("Jackpot forced skip recovery also failed", skipErr);
    }
    // Return original so caller can decide; next run will retry or cycle will roll anyway.
    return jackpot;
  }
}

export async function buildJackpotState(
  supabase: SupabaseReadClient,
  jackpot: JackpotRow,
  userId: string | null,
): Promise<LoyaltyJackpotState> {
  const now = new Date();
  const contributionEndsAt = new Date(jackpot.contribution_ends_at).getTime();
  const rawPhase = now.getTime() < contributionEndsAt ? "contribution" : "winner";
  const phase = rawPhase;

  const contributionSummary = await getContributionSummary(supabase, jackpot.id, userId);
  const contributionTotal = contributionSummary.contributionTotal;
  const pool = Number(jackpot.base_pool ?? JACKPOT_BASE_POOL) + contributionTotal;
  const previousWinnerIds = await getPreviousWinnerIds(supabase, jackpot.cycle_key);

  let eligibleCount = 0;
  try {
    const rpcPromise = supabase.rpc("get_jackpot_eligible_count", {
      p_excluded_user_ids: previousWinnerIds,
    });
    const { data: eligibleCountData, error: eligibleCountError } = await withTimeout(
      rpcPromise.then((r) => r),
      VAULT_CHECK_TIMEOUT_MS,
      "build:get_jackpot_eligible_count",
    ).catch((e) => {
      console.error("Jackpot eligible count RPC timed out or failed (vault check)", e);
      return { data: 0, error: null };
    });
    if (eligibleCountError) {
      console.error("Jackpot eligible count failed", eligibleCountError);
    }
    eligibleCount = Number(eligibleCountData ?? 0);
  } catch (e) {
    console.error("Jackpot eligible count vault check failed", e);
    eligibleCount = 0;
  }

  let contributionRowsData: ContributionRow[] = [];
  try {
    const contribPromise = supabase
      .from("loyalty_jackpot_contributions")
      .select("user_id, username, amount, created_at")
      .eq("jackpot_id", jackpot.id)
      .order("created_at", { ascending: false })
      .limit(12);
    const { data: contributionRows, error: contributionError } = await withTimeout(
      contribPromise.then((r) => r),
      VAULT_CHECK_TIMEOUT_MS,
      "build:recent_contributors",
    ).catch((e) => {
      console.error("Jackpot recent contributors lookup timed out or failed", e);
      return { data: [], error: null };
    });
    if (contributionError) {
      console.error("Jackpot recent contributors lookup failed", contributionError);
    }
    contributionRowsData = contributionRows ?? [];
  } catch (e) {
    console.error("Jackpot contributors vault check failed", e);
  }

  const participantCount = contributionSummary.participantCount;
  const userContributionTotal = contributionSummary.userContributionTotal;

  let userEligible = false;
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin, loyalty_streak, last_loyalty_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Jackpot user eligibility lookup failed", profileError);
    }

    userEligible =
      !Boolean(profile?.is_admin) &&
      hasActiveLoyaltyStreak(profile?.loyalty_streak ?? 0, profile?.last_loyalty_at ?? null) &&
      !previousWinnerIds.includes(userId);
  }

  const shouldLoadWinnerHistory = phase === "winner" || Boolean(jackpot.winner_selected_at);
  const currentWinners = shouldLoadWinnerHistory
    ? await getJackpotWinnersFromTransactions(supabase, jackpot.id)
    : [];
  const winnerProfileIds = shouldLoadWinnerHistory && jackpot.winner_user_id ? [jackpot.winner_user_id] : [];
  const { data: winnerProfiles } = winnerProfileIds.length > 0
    ? await supabase.rpc("get_public_profile_snippets", { p_user_ids: winnerProfileIds })
    : { data: [] };
  const winnerProfileMap = new Map(
    ((winnerProfiles ?? []) as ProfileSnippetRow[]).map((profile) => [profile.id, profile]),
  );
  const displayCurrentWinners =
    currentWinners.length > 0
      ? currentWinners
      : jackpot.winner_selected_at && jackpot.winner_username
          ? [{
            username: winnerProfileMap.get(jackpot.winner_user_id ?? "")?.username ?? jackpot.winner_username,
            rawUsername: winnerProfileMap.get(jackpot.winner_user_id ?? "")?.username ?? jackpot.winner_username,
            displayName: winnerProfileMap.get(jackpot.winner_user_id ?? "")?.display_name ?? null,
            display_name: winnerProfileMap.get(jackpot.winner_user_id ?? "")?.display_name ?? null,
            amount: Number(jackpot.winner_amount ?? pool),
            selectedAt: jackpot.winner_selected_at,
            place: 1 as const,
            usernameStyle: undefined,
          }]
        : [];

  const { data: previousJackpots, error: previousWinnerError } = shouldLoadWinnerHistory
    ? await supabase
      .from("loyalty_jackpots")
      .select("id, winner_user_id, winner_username, winner_amount, winner_selected_at")
      .not("winner_user_id", "is", null)
      .neq("cycle_key", jackpot.cycle_key)
      .order("starts_at", { ascending: false })
      .limit(1)
    : { data: [], error: null };

  if (previousWinnerError) {
    console.error("Previous jackpot winner display lookup failed", previousWinnerError);
  }

  const previousWinnerRows = await Promise.all(
    ((previousJackpots ?? []) as JackpotRow[]).map(async (previousJackpot) => {
      const winners = await getJackpotWinnersFromTransactions(supabase, previousJackpot.id);

      if (winners.length > 0) {
        return winners;
      }

      const fallbackProfileIds = previousJackpot.winner_user_id ? [previousJackpot.winner_user_id] : [];
      const { data: fallbackProfiles } = fallbackProfileIds.length > 0
        ? await supabase.rpc("get_public_profile_snippets", {
            p_user_ids: fallbackProfileIds,
          })
        : { data: [] };
      const fallbackProfileMap = new Map(
        ((fallbackProfiles ?? []) as ProfileSnippetRow[]).map((profile) => [profile.id, profile]),
      );

      return previousJackpot.winner_selected_at && previousJackpot.winner_username
        ? [{
            username: fallbackProfileMap.get(previousJackpot.winner_user_id ?? "")?.username ?? previousJackpot.winner_username,
            rawUsername: fallbackProfileMap.get(previousJackpot.winner_user_id ?? "")?.username ?? previousJackpot.winner_username,
            displayName: fallbackProfileMap.get(previousJackpot.winner_user_id ?? "")?.display_name ?? null,
            display_name: fallbackProfileMap.get(previousJackpot.winner_user_id ?? "")?.display_name ?? null,
            amount: Number(previousJackpot.winner_amount ?? 0),
            selectedAt: previousJackpot.winner_selected_at,
            place: 1 as const,
            usernameStyle: undefined,
          }]
        : [];
    }),
  );
  const displayPreviousWinners = previousWinnerRows.flat();
  const previousWinnerRow = displayPreviousWinners[0];
  const contributorUserIds = Array.from(
    new Set(((contributionRowsData ?? []) as ContributionRow[]).map((row) => String(row.user_id ?? "")).filter(Boolean)),
  );
  const { data: contributorProfiles, error: contributorProfileError } = await supabase.rpc("get_public_profile_snippets", {
    p_user_ids: contributorUserIds.length > 0 ? contributorUserIds : [],
  });

  if (contributorProfileError) {
    console.error("Jackpot contributor profile lookup failed", contributorProfileError);
  }

  const contributorProfileMap = new Map(
    ((contributorProfiles ?? []) as ProfileSnippetRow[]).map((profile) => [profile.id, profile]),
  );
  const contributorProfileByUsernameMap = new Map(
    ((contributorProfiles ?? []) as ProfileSnippetRow[]).map((profile) => [
      normalizeUsernameLookup(profile.username),
      profile,
    ]),
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
    recentContributors: ((contributionRowsData ?? []) as ContributionRow[]).map((row) => ({
      ...(() => {
        const resolvedProfile =
          contributorProfileMap.get(String(row.user_id ?? "")) ??
          contributorProfileByUsernameMap.get(normalizeUsernameLookup(row.username)) ??
          null;

        return {
          username: resolvedProfile?.username ?? row.username,
          rawUsername: resolvedProfile?.username ?? row.username,
          displayName: resolvedProfile?.display_name ?? null,
          display_name: resolvedProfile?.display_name ?? null,
        };
      })(),
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
  if (!isSupabasePublicConfigured) {
    const configErrors = getSupabasePublicConfigErrors();
    console.error("Jackpot route is not configured", configErrors);
    return jsonError(`Jackpot is not configured: ${configErrors.join(", ")}`);
  }

  try {
    const userId = await getAuthedUserId();
    const supabase = await createSupabaseServerClient();
    const jackpotResult = await getCurrentJackpot(supabase);

    const jackpot = jackpotResult.jackpot;

    if (!jackpot) {
      return Response.json({ jackpot: null, needsAdvance: true });
    }

    const state = await buildJackpotState(supabase, jackpot as JackpotRow, userId);
    const needsAdvance = Date.now() >= new Date(jackpot.contribution_ends_at).getTime()
      && !jackpot.winner_selected_at
      && !jackpot.skipped_at;

    return Response.json({ jackpot: state, needsAdvance });
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

    const rateLimit = await checkRateLimit(supabase, `jackpot-contribute:${userId}`, 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const { cycle, jackpot } = await getCurrentJackpot(supabase);

    if (!jackpot) {
      return jsonError("Jackpot is not available yet.", 404);
    }

    if (cycle.phase !== "contribution") {
      return jsonError("Jackpot contributions are closed for this cycle.", 400);
    }

    // The coin deduction, the contribution row, and the ledger entry all
    // happen inside one Postgres transaction (contribute_to_jackpot_atomic) -
    // a failure anywhere in that function rolls back everything it did,
    // and a committed coin deduction is therefore never possible without
    // its matching contribution + ledger record.
    const { data: rpcResult, error: rpcError } = await supabase.rpc("contribute_to_jackpot_atomic", {
      p_user_id: userId,
      p_jackpot_id: jackpot.id,
      p_cycle_key: jackpot.cycle_key,
      p_amount: amount,
    });

    if (rpcError) {
      console.error("Jackpot contribution RPC failed", rpcError);
      return jsonError("Jackpot contribution failed.", 500);
    }

    const outcome = rpcResult as
      | { error: "profile_not_found" | "admin_not_allowed" | "insufficient_funds" | "invalid_amount"; coins?: number; required?: number }
      | { coins: number };

    if ("error" in outcome) {
      if (outcome.error === "insufficient_funds") {
        return jsonError("Not enough Principessa Coins.", 400);
      }
      if (outcome.error === "admin_not_allowed") {
        return jsonError("Admin accounts cannot participate in the jackpot.", 403);
      }
      if (outcome.error === "invalid_amount") {
        return jsonError("Invalid contribution amount.", 400);
      }
      return jsonError("Profile not found.", 404);
    }

    try {
      const state = await buildJackpotState(supabase, jackpot, userId);

      return Response.json({ coins: outcome.coins, jackpot: state });
    } catch (error) {
      // The contribution itself already committed atomically and durably in
      // the RPC above - a failure building the response here is a read-side
      // problem only, so the contribution correctly stands (nothing to roll
      // back: coins, the contribution row, and the ledger entry are already
      // consistent with each other).
      console.error("Jackpot POST failed while building response state", error);
      return Response.json({ coins: outcome.coins, jackpot: null });
    }
  } catch (error) {
    console.error("Jackpot POST failed before completion", error);
    return jsonError(error instanceof Error ? error.message : "Jackpot contribution failed.");
  }
}
