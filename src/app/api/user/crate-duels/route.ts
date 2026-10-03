import { randomInt } from "node:crypto";
import { getFastUser } from "@/lib/supabase/fast-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { profileSelect } from "@/lib/profile-columns";
import { formatHandle } from "@/lib/username";
import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, getCrateItemImageUrl, type CrateRarity } from "@/lib/crates";
import { rollDuelHaul, type DuelSealedItem } from "@/lib/crate-duel-rolls";
import { lineupCost, lineupLabel } from "@/lib/crate-duel-lineup";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Crate Duels. A challenge is created and rolled in the same instant - the
// challenger's N crates are genuinely opened and paid for, then sealed until
// an opponent's own N-crate open reveals both hauls at once. Nobody, not
// even the challenger, can see the sealed haul early; that is deliberate,
// the same way a Mines layout or a Crash point is decided before anyone can
// see it. The client replays the reveal round by round from stored data for
// whoever looks at it next - see CrateDuels.tsx.
//
// Deliberately priced at each crate's PLAIN listed cost - no event discounts,
// no free-open grants. Both sides of a duel must face identical odds, and
// those modifiers are per-account and per-moment. How the haul itself is
// rolled, including the Principessa Case's reproduced Bad Luck Protection,
// lives in src/lib/crate-duel-rolls.ts.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const CRATE_DUEL_EXPIRES_HOURS = 48;
// Deliberately higher than the normal crate-open batch cap (5): a duel's
// escrowed haul isn't opened by the player's own click, so the reel/reveal
// performance ceiling that limits a solo batch open doesn't apply here.
export const CRATE_DUEL_MAX_QUANTITY = 10;

type SealedItem = DuelSealedItem;

type DuelRow = {
  accepted_at: string | null;
  challenger_id: string;
  challenger_items: SealedItem[];
  challenger_seen_at: string | null;
  challenger_total_value: number;
  crate_cost: number;
  crate_type: string;
  crates: string[] | null;
  total_cost: number | null;
  created_at: string;
  expires_at: string;
  id: string;
  opponent_id: string | null;
  opponent_items: SealedItem[] | null;
  opponent_seen_at: string | null;
  opponent_total_value: number | null;
  quantity: number;
  status: string;
  winner_id: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// `fast` skips the Auth server round trip (see fast-auth.ts); only the
// read-only GET uses it. Anything that moves coins keeps the full check.
async function requireUser(fast = false) {
  const authSupabase = await createSupabaseServerClient();
  if (fast) return getFastUser(authSupabase);
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

// Older duels (one crate type x quantity) have no `crates` column value.
function lineupOf(row: { crate_type: string; crates: string[] | null; quantity: number }) {
  return Array.isArray(row.crates) && row.crates.length > 0
    ? row.crates
    : Array.from({ length: row.quantity }, () => row.crate_type);
}

function roll(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

function itemsView(items: SealedItem[] | null | undefined) {
  return (items ?? []).map((entry) => {
    const def = SAMPLE_CRATE_ITEMS[entry.itemId];
    return {
      imageUrl: getCrateItemImageUrl(entry.itemId, def?.image_url ?? null),
      itemId: entry.itemId,
      name: def?.name ?? entry.itemId,
      rarity: (def?.rarity ?? null) as CrateRarity | null,
      sellValue: entry.sellValue,
      variant: entry.variant,
    };
  });
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser(true);
  if (!user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();

  const readLimit = await checkRateLimit(supabase, `crate-duels-read:${user.id}`, 30, 60);
  if (!readLimit.allowed) return rateLimitResponse(readLimit.retryAfterSeconds);
  const { data, error } = await supabase.rpc("get_crate_duel_lobby", { p_user_id: user.id });
  if (error) {
    console.error("[crate-duels] lobby read failed", error);
    return jsonError("The crate duels are temporarily unavailable.", 503);
  }

  const rows = (data ?? []) as DuelRow[];
  const userIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.challenger_id);
    if (row.opponent_id) userIds.add(row.opponent_id);
  }
  type ProfileLite = { avatar_url: string | null; display_name: string | null; id: string; username: string | null };
  const { data: profiles } = userIds.size
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", Array.from(userIds))
    : { data: [] as ProfileLite[] };
  const nameById = new Map(
    ((profiles ?? []) as ProfileLite[]).map((row) => [row.id, row.display_name?.trim() || formatHandle(row.username)]),
  );
  const avatarById = new Map(((profiles ?? []) as ProfileLite[]).map((row) => [row.id, row.avatar_url ?? null]));

  const duels = rows.map((row) => {
    const isMine = row.challenger_id === user.id || row.opponent_id === user.id;
    const revealed = row.status === "revealed";
    // The sealed haul stays sealed for everyone, including the challenger,
    // until a reveal actually happens - see the module note above.
    return {
      acceptedAt: row.accepted_at,
      challenger: nameById.get(row.challenger_id) ?? "unknown",
      challengerAvatar: avatarById.get(row.challenger_id) ?? null,
      challengerItems: revealed ? itemsView(row.challenger_items) : [],
      challengerTotal: revealed ? row.challenger_total_value : null,
      crateName: lineupLabel(lineupOf(row)),
      crateType: row.crate_type,
      crates: lineupOf(row),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      id: row.id,
      isMine,
      isMyChallenge: row.challenger_id === user.id,
      opponent: row.opponent_id ? nameById.get(row.opponent_id) ?? "unknown" : null,
      opponentAvatar: row.opponent_id ? avatarById.get(row.opponent_id) ?? null : null,
      opponentItems: revealed ? itemsView(row.opponent_items) : [],
      opponentTotal: revealed ? row.opponent_total_value : null,
      quantity: row.quantity,
      // Whether THIS account has watched the reveal, on any device.
      seenByMe: row.challenger_id === user.id ? row.challenger_seen_at !== null : row.opponent_seen_at !== null,
      status: row.status,
      totalCost: row.total_cost ?? row.crate_cost * row.quantity,
      winner: row.winner_id ? nameById.get(row.winner_id) ?? "unknown" : null,
      wonByMe: row.winner_id === user.id,
    };
  });

  return Response.json({
    duels,
    expiresHours: CRATE_DUEL_EXPIRES_HOURS,
    maxQuantity: CRATE_DUEL_MAX_QUANTITY,
    myLiveDuel: duels.find((duel) => duel.isMyChallenge && duel.status === "open") ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as
    | { action?: "accept" | "cancel" | "create" | "seen"; crates?: unknown; duelId?: string }
    | null;

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `crate-duels:${user.id}`, 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const respondWithProfile = async (extra: Record<string, unknown>) => {
    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();
    return Response.json({ ...extra, profile: profileData ?? null });
  };

  if (body?.action === "create") {
    const crates = Array.isArray(body.crates) ? body.crates.map((entry) => String(entry).trim()) : [];
    if (crates.length < 1 || crates.length > CRATE_DUEL_MAX_QUANTITY) {
      return jsonError(`Pick 1 to ${CRATE_DUEL_MAX_QUANTITY} crates.`, 422);
    }
    if (crates.some((crateType) => !CRATE_TYPES[crateType]?.enabled)) return jsonError("Invalid or disabled crate.", 422);

    const totalCost = lineupCost(crates);
    const rolled = rollDuelHaul(crates, roll);
    if (!rolled || totalCost <= 0) return jsonError("Crate is empty. Contact support.", 500);

    const { data, error } = await supabase.rpc("create_crate_duel", {
      p_crates: crates,
      p_expires_hours: CRATE_DUEL_EXPIRES_HOURS,
      p_items: rolled,
      p_total_cost: totalCost,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[crate-duels] create failed", error);
      return jsonError("The duel could not be created.", 500);
    }
    const result = (data ?? {}) as { coins?: number; duelId?: string; error?: string };
    if (result.error === "already_in_duel") return jsonError("You already have an open duel.", 409);
    if (result.error === "insufficient_coins") {
      return jsonError(`${lineupLabel(crates)} costs ${totalCost.toLocaleString()} coins. You have ${(result.coins ?? 0).toLocaleString()}.`, 402);
    }
    if (result.error) return jsonError("The duel could not be created.");
    return respondWithProfile({ created: true, duelId: result.duelId });
  }

  if (body?.action === "accept") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");

    const { data: duelRow } = await supabase
      .from("crate_duels")
      .select("crate_type, crates, quantity, status")
      .eq("id", body.duelId)
      .maybeSingle();
    if (!duelRow || duelRow.status !== "open") return jsonError("Someone else got there first.", 409);

    const rolled = rollDuelHaul(lineupOf(duelRow as { crate_type: string; crates: string[] | null; quantity: number }), roll);
    if (!rolled) return jsonError("Crate is empty. Contact support.", 500);

    const { data, error } = await supabase.rpc("accept_crate_duel", {
      p_duel_id: body.duelId,
      p_items: rolled,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[crate-duels] accept failed", error);
      return jsonError("The duel could not be accepted.", 500);
    }
    const result = (data ?? {}) as {
      challengerItems?: SealedItem[];
      challengerTotal?: number;
      error?: string;
      opponentItems?: SealedItem[];
      opponentTotal?: number;
      winnerId?: string | null;
    };
    if (result.error === "own_duel") return jsonError("You cannot duel yourself.", 409);
    if (result.error === "duel_not_open") return jsonError("Someone else got there first.", 409);
    if (result.error === "insufficient_coins") return jsonError("Not enough coins for this crate.", 402);
    if (result.error) return jsonError("The duel could not be accepted.");

    return respondWithProfile({
      accepted: true,
      challengerItems: itemsView(result.challengerItems),
      challengerTotal: result.challengerTotal ?? 0,
      opponentItems: itemsView(result.opponentItems),
      opponentTotal: result.opponentTotal ?? 0,
      winnerId: result.winnerId ?? null,
      wonByMe: result.winnerId === user.id,
    });
  }

  if (body?.action === "seen") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");
    // Only the caller's own side is touched, only once, and only for a duel
    // that has actually been revealed.
    const seenAt = new Date().toISOString();
    await supabase
      .from("crate_duels")
      .update({ challenger_seen_at: seenAt })
      .eq("id", body.duelId)
      .eq("challenger_id", user.id)
      .eq("status", "revealed")
      .is("challenger_seen_at", null);
    await supabase
      .from("crate_duels")
      .update({ opponent_seen_at: seenAt })
      .eq("id", body.duelId)
      .eq("opponent_id", user.id)
      .eq("status", "revealed")
      .is("opponent_seen_at", null);
    return Response.json({ ok: true });
  }

  if (body?.action === "cancel") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");
    const { data, error } = await supabase.rpc("cancel_crate_duel", {
      p_duel_id: body.duelId,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[crate-duels] cancel failed", error);
      return jsonError("The duel could not be cancelled.", 500);
    }
    const result = (data ?? {}) as { error?: string };
    if (result.error === "duel_not_open") return jsonError("An accepted duel cannot be cancelled.", 409);
    if (result.error) return jsonError("The duel could not be cancelled.");
    return respondWithProfile({ cancelled: true });
  }

  return jsonError("Invalid duel action.");
}
