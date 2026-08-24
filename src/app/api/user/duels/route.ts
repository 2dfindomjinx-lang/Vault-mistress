import { profileSelect } from "@/lib/server-game-rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { formatHandle } from "@/lib/username";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Tribute Duels. Coin stake in, a timed window of REAL Throne tributes, blind
// until the deadline, winner takes the pot. No duel code exists: totals are
// computed from the events already attributed to each participant, which is
// why one user can hold only one live duel at a time.

export const DUEL_MIN_STAKE = 2_500;
const FINALIZE_GRACE_MS = 5 * 60 * 1000;

type DuelRow = {
  accepted_at: string | null;
  challenger_id: string;
  challenger_total_usd: number | string | null;
  created_at: string;
  deadline: string | null;
  duration_hours: number;
  finalized_at: string | null;
  id: string;
  opponent_id: string | null;
  opponent_total_usd: number | string | null;
  stake_coins: number;
  status: string;
  winner_id: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function requireUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();

  // Reveal is lazy: any active duel past deadline + grace is finalized on the
  // first read that sees it, whoever that reader is.
  const { data: overdue } = await supabase
    .from("tribute_duels")
    .select("id")
    .eq("status", "active")
    .lt("deadline", new Date(Date.now() - FINALIZE_GRACE_MS).toISOString())
    .limit(5);
  for (const duel of (overdue ?? []) as Array<{ id: string }>) {
    const { error: finalizeError } = await supabase.rpc("finalize_tribute_duel", { p_duel_id: duel.id });
    if (finalizeError) console.error("[duels] finalize failed", { duelId: duel.id, finalizeError });
  }

  const { data, error } = await supabase
    .from("tribute_duels")
    .select("id, challenger_id, opponent_id, stake_coins, duration_hours, status, created_at, accepted_at, deadline, challenger_total_usd, opponent_total_usd, winner_id, finalized_at")
    .in("status", ["open", "active", "revealed"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return jsonError(error.message, 500);

  const rows = (data ?? []) as DuelRow[];
  const userIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.challenger_id);
    if (row.opponent_id) userIds.add(row.opponent_id);
  }
  const { data: profiles } = userIds.size
    ? await supabase.from("profiles").select("id, username, display_name").in("id", Array.from(userIds))
    : { data: [] as Array<{ display_name: string | null; id: string; username: string | null }> };
  const nameById = new Map(
    ((profiles ?? []) as Array<{ display_name: string | null; id: string; username: string | null }>).map((row) => [
      row.id,
      row.display_name?.trim() || formatHandle(row.username),
    ]),
  );

  const duels = rows.map((row) => ({
    acceptedAt: row.accepted_at,
    challenger: nameById.get(row.challenger_id) ?? "unknown",
    challengerTotalUsd: row.challenger_total_usd === null ? null : Number(row.challenger_total_usd),
    createdAt: row.created_at,
    deadline: row.deadline,
    durationHours: row.duration_hours,
    id: row.id,
    isMine: row.challenger_id === user.id || row.opponent_id === user.id,
    isMyChallenge: row.challenger_id === user.id,
    opponent: row.opponent_id ? nameById.get(row.opponent_id) ?? "unknown" : null,
    opponentTotalUsd: row.opponent_total_usd === null ? null : Number(row.opponent_total_usd),
    stakeCoins: row.stake_coins,
    status: row.status,
    winner: row.winner_id ? nameById.get(row.winner_id) ?? "unknown" : null,
    wonByMe: row.winner_id === user.id,
  }));

  return Response.json({
    duels,
    minStake: DUEL_MIN_STAKE,
    myLiveDuel: duels.find((duel) => duel.isMine && (duel.status === "open" || duel.status === "active")) ?? null,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as
    | { action?: "accept" | "cancel" | "create"; duelId?: string; durationHours?: number; stake?: number }
    | null;

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `duels:${user.id}`, 10, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const respondWithProfile = async (extra: Record<string, unknown>) => {
    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();
    return Response.json({ ...extra, profile: profileData ?? null });
  };

  if (body?.action === "create") {
    const stake = Math.floor(Number(body.stake));
    const duration = Math.floor(Number(body.durationHours ?? 24));
    if (!Number.isInteger(stake) || stake < DUEL_MIN_STAKE) {
      return jsonError(`The minimum stake is ${DUEL_MIN_STAKE.toLocaleString()} coins.`);
    }
    const { data, error } = await supabase.rpc("create_tribute_duel", {
      p_duration_hours: duration,
      p_stake: stake,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[duels] create failed", error);
      return jsonError("The duel could not be created.", 500);
    }
    const result = (data ?? {}) as { coins?: number; duelId?: string; error?: string };
    if (result.error === "already_in_duel") return jsonError("You already have a live duel. Finish it first.", 409);
    if (result.error === "insufficient_coins") {
      return jsonError(`Staking costs ${stake.toLocaleString()} coins. You have ${(result.coins ?? 0).toLocaleString()}.`, 402);
    }
    if (result.error) return jsonError("The duel could not be created.");
    return respondWithProfile({ created: true, duelId: result.duelId });
  }

  if (body?.action === "accept") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");
    const { data, error } = await supabase.rpc("accept_tribute_duel", {
      p_duel_id: body.duelId,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[duels] accept failed", error);
      return jsonError("The duel could not be accepted.", 500);
    }
    const result = (data ?? {}) as { coins?: number; deadline?: string; error?: string; stake?: number };
    if (result.error === "already_in_duel") return jsonError("You already have a live duel. Finish it first.", 409);
    if (result.error === "own_duel") return jsonError("You cannot duel yourself.", 409);
    if (result.error === "duel_not_open") return jsonError("Someone else got there first.", 409);
    if (result.error === "insufficient_coins") {
      return jsonError(
        `Matching the stake costs ${(result.stake ?? 0).toLocaleString()} coins. You have ${(result.coins ?? 0).toLocaleString()}.`,
        402,
      );
    }
    if (result.error) return jsonError("The duel could not be accepted.");
    return respondWithProfile({ accepted: true, deadline: result.deadline ?? null });
  }

  if (body?.action === "cancel") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");
    const { data, error } = await supabase.rpc("cancel_tribute_duel", {
      p_duel_id: body.duelId,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[duels] cancel failed", error);
      return jsonError("The duel could not be cancelled.", 500);
    }
    const result = (data ?? {}) as { error?: string };
    if (result.error === "duel_not_open") return jsonError("An accepted duel cannot be cancelled. The window runs.", 409);
    if (result.error) return jsonError("The duel could not be cancelled.");
    return respondWithProfile({ cancelled: true });
  }

  return jsonError("Invalid duel action.");
}
