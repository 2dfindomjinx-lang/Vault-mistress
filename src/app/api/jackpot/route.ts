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

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

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
  const { data, error } = await supabase
    .from("loyalty_jackpots")
    .select("winner_user_id")
    .not("winner_user_id", "is", null)
    .neq("cycle_key", currentCycleKey)
    .order("starts_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("Previous jackpot winners lookup failed", error);
    return [];
  }

  return (data ?? [])
    .map((row) => String(row.winner_user_id ?? ""))
    .filter(Boolean);
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
  const eligibleCount = await getEligibleCount(supabase, previousWinnerIds);
  const winner = await getRandomEligibleProfile(supabase, previousWinnerIds, eligibleCount);
  const now = new Date().toISOString();

  if (!winner) {
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

  const nextCoins = Number(winner.coins ?? 0) + pool;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", winner.id);

  if (profileError) {
    console.error("Jackpot winner profile reward failed", profileError);
    throw profileError;
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    user_id: winner.id,
    amount: pool,
    reason: "jackpot_reward",
    balance_before: Number(winner.coins ?? 0),
    balance_after: nextCoins,
    metadata: {
      jackpotId: jackpot.id,
      cycleKey: jackpot.cycle_key,
      tributeTotalChanged: false,
    },
  });

  if (transactionError) {
    console.error("Jackpot reward transaction failed", transactionError);
  }

  const { data, error } = await supabase
    .from("loyalty_jackpots")
    .update({
      winner_user_id: winner.id,
      winner_username: winner.username,
      winner_amount: pool,
      winner_selected_at: now,
      updated_at: now,
    })
    .eq("id", jackpot.id)
    .select("*")
    .single();

  if (error) {
    console.error("Jackpot winner update failed", error);
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

  const { data: previousWinners, error: previousWinnerError } = await supabase
    .from("loyalty_jackpots")
    .select("winner_username, winner_amount, winner_selected_at")
    .not("winner_user_id", "is", null)
    .neq("cycle_key", jackpot.cycle_key)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (previousWinnerError) {
    console.error("Previous jackpot winner display lookup failed", previousWinnerError);
  }

  const previousWinnerRow = previousWinners?.[0];

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
    })),
    currentWinner: jackpot.winner_selected_at && jackpot.winner_username
      ? {
          username: jackpot.winner_username,
          amount: Number(jackpot.winner_amount ?? pool),
          selectedAt: jackpot.winner_selected_at,
        }
      : null,
    previousWinner: previousWinnerRow?.winner_selected_at && previousWinnerRow?.winner_username
      ? {
          username: previousWinnerRow.winner_username,
          amount: Number(previousWinnerRow.winner_amount ?? 0),
          selectedAt: previousWinnerRow.winner_selected_at,
        }
      : null,
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

    const { error: contributionError } = await supabase
      .from("loyalty_jackpot_contributions")
      .insert({
        jackpot_id: jackpot.id,
        user_id: userId,
        username: profile.username,
        amount,
      });

    if (contributionError) {
      console.error("Jackpot contribution insert failed", contributionError);
      throw contributionError;
    }

    const { error: transactionError } = await supabase.from("coin_transactions").insert({
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
    });

    if (transactionError) {
      console.error("Jackpot contribution transaction failed", transactionError);
    }

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
    return jsonError(error instanceof Error ? error.message : "Jackpot contribution failed.");
  }
}
