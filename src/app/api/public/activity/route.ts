import { getMoneyGrantReason } from "@/lib/money-grant-ledger";
import { SAMPLE_CRATE_ITEMS, type CrateRarity } from "@/lib/crates";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requestFingerprint } from "@/lib/request-fingerprint";
import { formatHandle } from "@/lib/username";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

// Feeds the login screen's live ticker. Public on purpose: its whole job is to
// prove to someone who has NOT signed in that the court is alive.
//
// Two rules shape everything here:
//
// 1. EVERY EVENT IS REAL. A small site is tempted to pad a feed; the first
//    person who spots an invented handle costs more than an empty feed ever
//    would. Liveness comes instead from a wide window (30 days) and several
//    event types, so the loop stays full without inventing anything.
//
// 2. ONLY WHAT IS ALREADY PUBLIC. Handles appear exactly where they already
//    appear inside the site (tributes, crate pulls, the furnace board), and
//    hide_from_leaderboard / admin rows are excluded everywhere a name is
//    attached, mirroring get_public_top_tributors.

export type PublicActivityEvent = {
  kind: "tribute" | "crate" | "burn" | "join";
  text: string;
  accent: string | null;
  at: string;
};

const WINDOW_DAYS = 30;
const PER_SOURCE_LIMIT = 20;
const FEED_LIMIT = 40;

type ProfileSnippet = { display_name: string | null; hide_from_leaderboard: boolean | null; is_admin: boolean | null; username: string | null };

function nameFor(profile: ProfileSnippet | undefined): string | null {
  if (!profile) return null;
  if (profile.hide_from_leaderboard || profile.is_admin) return null;
  return profile.display_name?.trim() || (profile.username ? formatHandle(profile.username) : null);
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("Public activity feed is not configured", getSupabaseAdminConfigErrors());
    return Response.json({ events: [], stats: null }, { status: 503 });
  }

  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(supabase, `public-activity:${requestFingerprint(request)}`, 60, 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [tributesResult, burnsResult, cratesResult, joinsResult, membersResult, goalResult] = await Promise.all([
    supabase
      .from("money_transactions")
      .select("user_id, amount, metadata, created_at")
      .eq("reason", getMoneyGrantReason("public"))
      .gt("amount", 0)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("money_transactions")
      .select("user_id, amount, created_at")
      .eq("reason", "burn:tribute-furnace")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("crate_opens")
      .select("user_id, item_id, opened_at")
      .gte("opened_at", since)
      .order("opened_at", { ascending: false })
      .limit(120),
    supabase
      .from("profiles")
      .select("id, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.rpc("get_public_tribute_goal"),
  ]);

  // Profile lookups are batched across every source so the feed costs one
  // round trip, not one per event.
  const userIds = new Set<string>();
  for (const row of tributesResult.data ?? []) if (row.user_id) userIds.add(row.user_id as string);
  for (const row of burnsResult.data ?? []) if (row.user_id) userIds.add(row.user_id as string);
  for (const row of cratesResult.data ?? []) if (row.user_id) userIds.add(row.user_id as string);
  for (const row of joinsResult.data ?? []) if (row.id) userIds.add(row.id as string);

  const { data: profileRows } = userIds.size
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, hide_from_leaderboard, is_admin")
        .in("id", Array.from(userIds))
    : { data: [] as Array<ProfileSnippet & { id: string }> };

  const profiles = new Map<string, ProfileSnippet>(
    ((profileRows ?? []) as Array<ProfileSnippet & { id: string }>).map((row) => [row.id, row]),
  );

  const events: PublicActivityEvent[] = [];

  for (const row of tributesResult.data ?? []) {
    const name = nameFor(profiles.get(row.user_id as string));
    if (!name) continue;
    const metadata = (row.metadata ?? {}) as { throneMoneyBaseAmount?: number };
    const usd = Math.max(0, Number(metadata.throneMoneyBaseAmount) || Number(row.amount) || 0);
    if (usd <= 0) continue;
    events.push({
      accent: `$${usd.toLocaleString()}`,
      at: String(row.created_at),
      kind: "tribute",
      text: `${name} sent a $${usd.toLocaleString()} tribute`,
    });
  }

  for (const row of burnsResult.data ?? []) {
    const name = nameFor(profiles.get(row.user_id as string));
    if (!name) continue;
    const burned = Math.abs(Number(row.amount) || 0);
    if (burned <= 0) continue;
    events.push({
      accent: "nothing back",
      at: String(row.created_at),
      kind: "burn",
      text: `${name} burned ${burned.toLocaleString()} Money in the Furnace`,
    });
  }

  // Only pulls worth announcing. A feed of commons reads as noise; epic and up
  // reads as a slot machine paying out in public.
  const announceRarities: CrateRarity[] = ["epic", "legendary", "ultimate"];
  let crateEvents = 0;
  for (const row of cratesResult.data ?? []) {
    if (crateEvents >= PER_SOURCE_LIMIT) break;
    const item = SAMPLE_CRATE_ITEMS[row.item_id as string];
    if (!item || !announceRarities.includes(item.rarity as CrateRarity)) continue;
    const name = nameFor(profiles.get(row.user_id as string));
    if (!name) continue;
    crateEvents += 1;
    events.push({
      accent: item.rarity,
      at: String(row.opened_at),
      kind: "crate",
      text: `${name} pulled ${item.name}`,
    });
  }

  for (const row of joinsResult.data ?? []) {
    const name = nameFor(profiles.get(row.id as string));
    if (!name) continue;
    events.push({
      accent: null,
      at: String(row.created_at),
      kind: "join",
      text: `${name} entered the court`,
    });
  }

  events.sort((left, right) => (left.at < right.at ? 1 : -1));

  // Table-returning RPC: the client hands back an array of rows.
  const goal = (Array.isArray(goalResult.data) ? goalResult.data[0] : goalResult.data) as
    | { raised_usd?: number | string }
    | undefined;

  return Response.json(
    {
      events: events.slice(0, FEED_LIMIT),
      stats: {
        members: membersResult.count ?? 0,
        raisedUsd: Math.max(0, Number(goal?.raised_usd) || 0),
      },
    },
    // Sixty seconds is fresh enough for a ticker and keeps one viral post from
    // turning into a database stampede.
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } },
  );
}
