import { randomInt } from "node:crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { profileSelect } from "@/lib/profile-columns";
import { formatHandle } from "@/lib/username";
import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, getCrateItemImageUrl, type CrateRarity } from "@/lib/crates";
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
// Deliberately priced and rolled at each crate's PLAIN listed cost and drop
// table - no event discounts, no free-open grants, no pity counter. Both
// sides of a duel must face identical odds for the contest to mean anything,
// and those modifiers are per-account and per-moment.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const CRATE_DUEL_EXPIRES_HOURS = 48;
// Deliberately higher than the normal crate-open batch cap (5): a duel's
// escrowed haul isn't opened by the player's own click, so the reel/reveal
// performance ceiling that limits a solo batch open doesn't apply here.
export const CRATE_DUEL_MAX_QUANTITY = 10;

type SealedItem = { itemId: string; sellValue: number; variant: string };

type DuelRow = {
  accepted_at: string | null;
  challenger_id: string;
  challenger_items: SealedItem[];
  challenger_total_value: number;
  crate_cost: number;
  crate_type: string;
  created_at: string;
  expires_at: string;
  id: string;
  opponent_id: string | null;
  opponent_items: SealedItem[] | null;
  opponent_total_value: number | null;
  quantity: number;
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

function roll(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

// Draws from the crate's plain, unadjusted drop table - see the module note
// on why duels never use the event-adjusted or pity-affected odds. Called
// once per crate in the batch, each with its own independent roll.
function rollBaselineCrateDrops(crateType: string, quantity: number): SealedItem[] | null {
  const crate = CRATE_TYPES[crateType];
  if (!crate) return null;
  const totalWeight = crate.drops.reduce((sum, drop) => sum + drop.weight, 0);
  if (totalWeight <= 0) return null;

  const results: SealedItem[] = [];
  for (let i = 0; i < quantity; i += 1) {
    let cursor = Math.max(0, Math.min(0.999999, roll())) * totalWeight;
    let picked: SealedItem | null = null;
    for (const drop of crate.drops) {
      cursor -= drop.weight;
      if (cursor < 0) {
        const item = SAMPLE_CRATE_ITEMS[drop.item_id];
        if (!item) continue;
        picked = { itemId: drop.item_id, sellValue: item.sell_value, variant: drop.variant ?? "normal" };
        break;
      }
    }
    if (!picked) {
      const last = crate.drops[crate.drops.length - 1];
      const lastItem = last ? SAMPLE_CRATE_ITEMS[last.item_id] : null;
      if (!last || !lastItem) return null;
      picked = { itemId: last.item_id, sellValue: lastItem.sell_value, variant: last.variant ?? "normal" };
    }
    results.push(picked);
  }
  return results;
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
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();

  // Lazy expiry, exactly like Tribute Duels: whoever reads next sweeps
  // whatever has gone stale. No cron job needed.
  const { error: expireError } = await supabase.rpc("expire_stale_crate_duels", { p_limit: 20 });
  if (expireError) console.error("[crate-duels] expire sweep failed", expireError);

  const { data, error } = await supabase
    .from("crate_duels")
    .select(
      "id, challenger_id, opponent_id, crate_type, crate_cost, quantity, status, created_at, accepted_at, expires_at, challenger_items, challenger_total_value, opponent_items, opponent_total_value, winner_id",
    )
    .in("status", ["open", "revealed"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return jsonError(error.message, 500);

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
      crateCost: row.crate_cost,
      crateName: CRATE_TYPES[row.crate_type]?.name ?? row.crate_type,
      crateType: row.crate_type,
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
      status: row.status,
      winner: row.winner_id ? nameById.get(row.winner_id) ?? "unknown" : null,
      wonByMe: row.winner_id === user.id,
    };
  });

  return Response.json({
    duels,
    expiresHours: CRATE_DUEL_EXPIRES_HOURS,
    maxQuantity: CRATE_DUEL_MAX_QUANTITY,
    myLiveDuel: duels.find((duel) => duel.isMyChallenge && duel.status === "open") ?? null,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as
    | { action?: "accept" | "cancel" | "create"; crateType?: string; duelId?: string; quantity?: number }
    | null;

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `crate-duels:${user.id}`, 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const respondWithProfile = async (extra: Record<string, unknown>) => {
    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();
    return Response.json({ ...extra, profile: profileData ?? null });
  };

  if (body?.action === "create") {
    const crateType = body.crateType?.trim() ?? "";
    const crateDef = CRATE_TYPES[crateType];
    if (!crateDef || !crateDef.enabled) return jsonError("Invalid or disabled crate.", 422);

    const quantity = Math.max(1, Math.min(CRATE_DUEL_MAX_QUANTITY, Math.floor(Number(body.quantity) || 1)));
    const rolled = rollBaselineCrateDrops(crateType, quantity);
    if (!rolled) return jsonError("Crate is empty. Contact support.", 500);

    const { data, error } = await supabase.rpc("create_crate_duel", {
      p_crate_cost: crateDef.cost,
      p_crate_type: crateType,
      p_expires_hours: CRATE_DUEL_EXPIRES_HOURS,
      p_items: rolled,
      p_quantity: quantity,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[crate-duels] create failed", error);
      return jsonError("The duel could not be created.", 500);
    }
    const result = (data ?? {}) as { coins?: number; duelId?: string; error?: string };
    if (result.error === "already_in_duel") return jsonError("You already have an open crate duel. Finish or cancel it first.", 409);
    if (result.error === "insufficient_coins") {
      const total = crateDef.cost * quantity;
      return jsonError(`Opening ${quantity}x ${crateDef.name} costs ${total.toLocaleString()} coins. You have ${(result.coins ?? 0).toLocaleString()}.`, 402);
    }
    if (result.error) return jsonError("The duel could not be created.");
    return respondWithProfile({ created: true, duelId: result.duelId });
  }

  if (body?.action === "accept") {
    if (typeof body.duelId !== "string" || !body.duelId) return jsonError("Missing duel.");

    const { data: duelRow } = await supabase
      .from("crate_duels")
      .select("crate_type, quantity, status")
      .eq("id", body.duelId)
      .maybeSingle();
    if (!duelRow || duelRow.status !== "open") return jsonError("Someone else got there first.", 409);

    const rolled = rollBaselineCrateDrops(duelRow.crate_type, duelRow.quantity);
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
