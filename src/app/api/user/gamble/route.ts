import { randomInt } from "node:crypto";
import { profileSelect } from "@/lib/server-game-rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  crawlWinProbabilities,
  diceSum,
  DOUBLE_OR_NOTHING_CHANCE,
  drawCrawlOdds,
  isGambleGameId,
  isValidBet,
  MINES_GRID,
  MINES_OPTIONS,
  PLINKO_MULTIPLIERS,
  PLINKO_ROWS,
  ROULETTE_RINGS,
  rollSlotReel,
  sampleCrashPoint,
  slotsPayoutMultiplier,
} from "@/lib/gamble";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// The Gamble Hall's single API. Every outcome is rolled HERE, with crypto
// randomness, before any coins move; the client is a renderer with buttons.

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function roll(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

async function requireUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function openRound(
  supabase: SupabaseAdmin,
  userId: string,
  game: string,
  wager: number,
  state: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("gamble_open_round", {
    p_game: game,
    // Kept in the deployed RPC signature for backwards compatibility. Zero is
    // intentional: the hall no longer enforces a daily loss ceiling.
    p_loss_cap: 0,
    p_state: state,
    p_user_id: userId,
    p_wager: wager,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as { coins?: number; error?: string; roundId?: string };
}

async function playRound(
  supabase: SupabaseAdmin,
  userId: string,
  game: string,
  wager: number,
  state: Record<string, unknown>,
  payout: number,
  sourceRoundId: string | null = null,
) {
  const { data, error } = await supabase.rpc("gamble_play_round", {
    p_game: game,
    p_payout: payout,
    p_source_round_id: sourceRoundId,
    p_state: state,
    p_user_id: userId,
    p_wager: wager,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as { coins?: number; error?: string; payout?: number; roundId?: string };
}

function openError(result: { error?: string }) {
  if (result.error === "insufficient_coins") return jsonError("Not enough coins for that bet.", 402);
  if (result.error === "race_closed") return jsonError("That race sheet is gone. Draw a new one.", 409);
  if (result.error === "invalid_bet") return jsonError("Bets run 100 to 5,000 coins.");
  return jsonError("The table refused the bet.");
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        bet?: number;
        cell?: number;
        game?: string;
        lane?: number;
        mines?: number;
        ring?: string;
        roundId?: string;
      }
    | null;
  if (!body?.action) return jsonError("Invalid gamble action.");

  const supabase = createSupabaseAdminClient();
  // crash-status is a read-only poll fired every ~650ms while Her Patience
  // runs, so it gets its own generous bucket instead of eating the play limit.
  const isStatusPoll = body.action === "crash-status";
  const limit = isStatusPoll
    ? await checkRateLimit(supabase, `gamble-status:${user.id}`, 150, 60)
    : await checkRateLimit(supabase, `gamble:${user.id}`, 30, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const finishWithProfile = async (extra: Record<string, unknown>) => {
    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();
    return Response.json({ ...extra, profile: profileData ?? null });
  };

  const bet = Math.floor(Number(body.bet));

  // ------------------------------------------------------------------ slots
  if (body.action === "slots") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const reels: [number, number, number] = [rollSlotReel(roll()), rollSlotReel(roll()), rollSlotReel(roll())];
    const multiplier = slotsPayoutMultiplier(reels);
    const payout = Math.floor(bet * multiplier);

    const opened = await playRound(supabase, user.id, "slots", bet, { multiplier, reels }, payout);
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ multiplier, payout, reels, roundId: opened.roundId });
  }

  // ------------------------------------------------------------------- dice
  if (body.action === "dice") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const mine: [number, number] = [randomInt(1, 7), randomInt(1, 7)];
    const hers: [number, number] = [randomInt(1, 7), randomInt(1, 7)];
    const win = diceSum(mine) > diceSum(hers);
    const payout = win ? bet * 2 : 0;

    const opened = await playRound(supabase, user.id, "dice", bet, { hers, mine, win }, payout);
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ hers, mine, payout, roundId: opened.roundId, win });
  }

  // --------------------------------------------------------------- roulette
  if (body.action === "roulette") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const ring = ROULETTE_RINGS.find((entry) => entry.id === body.ring);
    if (!ring) return jsonError("Pick a ring.");
    const win = roll() < ring.winChance;
    const payout = win ? Math.floor(bet * ring.multiplier) : 0;

    const opened = await playRound(supabase, user.id, "roulette", bet, { ring: ring.id, win }, payout);
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ payout, ring: ring.id, roundId: opened.roundId, win });
  }

  // ----------------------------------------------------------------- plinko
  if (body.action === "plinko") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    // The path IS the outcome: 12 crypto coin-flips, replayed by the client.
    const path: number[] = Array.from({ length: PLINKO_ROWS }, () => randomInt(0, 2));
    const bucket = path.reduce((sum, step) => sum + step, 0);
    const multiplier = PLINKO_MULTIPLIERS[bucket];
    const payout = Math.floor(bet * multiplier);

    const opened = await playRound(supabase, user.id, "plinko", bet, { bucket, multiplier, path }, payout);
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ bucket, multiplier, path, payout, roundId: opened.roundId });
  }

  // ------------------------------------------------------------------ crawl
  if (body.action === "crawl-race") {
    // A race sheet costs nothing: odds are drawn and pinned server-side so
    // the bet that follows cannot argue about them.
    const odds = drawCrawlOdds([roll(), roll(), roll(), roll()]);
    const { data, error } = await supabase.rpc("gamble_open_round", {
      p_game: "crawl",
      p_loss_cap: 0,
      p_state: { odds },
      p_user_id: user.id,
      p_wager: 0,
    });
    if (error) return jsonError("The race could not be drawn.", 500);
    const result = (data ?? {}) as { error?: string; roundId?: string };
    if (result.error || !result.roundId) return jsonError("The race could not be drawn.");
    return Response.json({ odds, raceId: result.roundId });
  }

  if (body.action === "crawl-bet") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const lane = Math.floor(Number(body.lane));
    if (!Number.isInteger(lane) || lane < 0 || lane > 3) return jsonError("Pick a collar.");
    if (typeof body.roundId !== "string") return jsonError("Missing race.");

    const { data: raceRow } = await supabase
      .from("gamble_rounds")
      .select("id, state, status, game")
      .eq("id", body.roundId)
      .eq("user_id", user.id)
      .eq("game", "crawl")
      .maybeSingle();
    const raceState = (raceRow?.state ?? {}) as { odds?: number[]; bet?: boolean };
    if (!raceRow || raceRow.status !== "open" || !Array.isArray(raceState.odds) || raceState.bet) {
      return jsonError("That race sheet is gone. Draw a new one.", 409);
    }

    const odds = raceState.odds;
    const probabilities = crawlWinProbabilities(odds);
    const winRoll = roll();
    let cursor = 0;
    let winner = 3;
    for (let index = 0; index < probabilities.length; index += 1) {
      cursor += probabilities[index];
      if (winRoll < cursor) {
        winner = index;
        break;
      }
    }
    const win = winner === lane;
    const payout = win ? Math.floor(bet * odds[lane]) : 0;

    const opened = await playRound(
      supabase,
      user.id,
      "crawl",
      bet,
      { lane, odds, raceId: raceRow.id, win, winner },
      payout,
      raceRow.id,
    );
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ odds, payout, roundId: opened.roundId, win, winner });
  }

  // ------------------------------------------------------------------ mines
  if (body.action === "mines-open") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const mineCount = Math.floor(Number(body.mines));
    if (!MINES_OPTIONS.includes(mineCount as (typeof MINES_OPTIONS)[number])) {
      return jsonError("Mine count must be 5, 8 or 12.");
    }
    const cells = Array.from({ length: MINES_GRID }, (_, index) => index);
    for (let index = cells.length - 1; index > 0; index -= 1) {
      const swap = randomInt(0, index + 1);
      [cells[index], cells[swap]] = [cells[swap], cells[index]];
    }
    const mines = cells.slice(0, mineCount).sort((a, b) => a - b);

    const opened = await openRound(supabase, user.id, "mines", bet, { mineCount, mines, picks: [] });
    if (opened.error || !opened.roundId) return openError(opened);
    return finishWithProfile({ mineCount, roundId: opened.roundId });
  }

  if (body.action === "mines-pick") {
    const cell = Math.floor(Number(body.cell));
    if (typeof body.roundId !== "string" || !Number.isInteger(cell) || cell < 0 || cell >= MINES_GRID) {
      return jsonError("Invalid pick.");
    }
    const { data, error } = await supabase.rpc("gamble_mines_pick", {
      p_cell: cell,
      p_round_id: body.roundId,
      p_user_id: user.id,
    });
    if (error) return jsonError("The box would not open.", 500);
    const result = (data ?? {}) as {
      bust?: boolean;
      error?: string;
      mines?: number[];
      multiplier?: number;
      payout?: number;
      picks?: number[];
    };
    if (result.error === "already_opened") return jsonError("Already opened.", 409);
    if (result.error === "round_closed") return jsonError("That round is over.", 409);
    if (result.error) return jsonError("The box would not open.");
    return result.bust ? finishWithProfile(result) : Response.json(result);
  }

  if (body.action === "mines-cashout") {
    if (typeof body.roundId !== "string") return jsonError("Missing round.");
    const { data, error } = await supabase.rpc("gamble_mines_cashout", {
      p_round_id: body.roundId,
      p_user_id: user.id,
    });
    if (error) return jsonError("The cashout failed.", 500);
    const result = (data ?? {}) as { error?: string; multiplier?: number; payout?: number; roundId?: string };
    if (result.error === "no_picks") return jsonError("Open at least one box first.");
    if (result.error === "round_closed") return jsonError("That round is over.", 409);
    if (result.error) return jsonError("The cashout failed.");
    return finishWithProfile(result);
  }

  // ------------------------------------------------------------------ crash
  if (body.action === "crash-open") {
    if (!isValidBet(bet)) return jsonError("Bets run 100 to 5,000 coins.");
    const crashPoint = sampleCrashPoint(roll());
    const opened = await openRound(supabase, user.id, "crash", bet, { crashPoint });
    if (opened.error || !opened.roundId) return openError(opened);
    // The crash point stays server-side; the client only learns it when the
    // round ends, one way or the other. elapsedMs lets the display sync its
    // clock to the round's real start (the DB row's created_at).
    const { data: createdRow } = await supabase
      .from("gamble_rounds")
      .select("created_at")
      .eq("id", opened.roundId)
      .single();
    const elapsedMs = createdRow ? Math.max(0, Date.now() - new Date(createdRow.created_at).getTime()) : 0;
    return finishWithProfile({ elapsedMs, roundId: opened.roundId });
  }

  // The client polls this while the round runs. The moment the server clock
  // has passed the crash point, the round settles at zero and the truth is
  // revealed - so the display can never keep climbing past a bust.
  if (body.action === "crash-status") {
    if (typeof body.roundId !== "string") return jsonError("Missing round.");
    const { data, error } = await supabase.rpc("gamble_crash_status", {
      p_round_id: body.roundId,
      p_user_id: user.id,
    });
    if (error) return jsonError("The round status is unavailable.", 500);
    const result = (data ?? {}) as { crashPoint?: number; crashed?: boolean; elapsedMs?: number; error?: string };
    if (result.error) return jsonError("That round is over.", 409);
    return Response.json(result);
  }

  if (body.action === "crash-cashout") {
    if (typeof body.roundId !== "string") return jsonError("Missing round.");
    const { data, error } = await supabase.rpc("gamble_crash_cashout", {
      p_round_id: body.roundId,
      p_user_id: user.id,
    });
    if (error) return jsonError("The cashout failed.", 500);
    const result = (data ?? {}) as {
      crashPoint?: number;
      error?: string;
      multiplier?: number;
      payout?: number;
      survived?: boolean;
    };
    if (result.error === "round_closed") return jsonError("That round is over.", 409);
    if (result.error) return jsonError("The cashout failed.");
    return finishWithProfile(result);
  }

  // ------------------------------------------------------------------ double
  if (body.action === "double") {
    if (typeof body.roundId !== "string") return jsonError("Missing round.");
    const won = roll() < DOUBLE_OR_NOTHING_CHANCE;
    const { data, error } = await supabase.rpc("gamble_double_round", {
      p_round_id: body.roundId,
      p_user_id: user.id,
      p_won: won,
    });
    if (error) return jsonError("The double could not be played.", 500);
    const result = (data ?? {}) as { error?: string; payout?: number; won?: boolean };
    if (result.error === "not_doublable") return jsonError("Nothing on that round to double.", 409);
    if (result.error === "payout_unavailable") {
      return jsonError("Keep the full winnings in your coin balance if you want to risk them.", 409);
    }
    if (result.error) return jsonError("The double could not be played.");
    return finishWithProfile({ payout: result.payout ?? 0, won: result.won === true });
  }

  if (isGambleGameId(body.action)) return jsonError("Unknown gamble step.");
  return jsonError("Invalid gamble action.");
}
