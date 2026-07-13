import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { getCurrentCommunityGoal, inflateUserPrestigeBadge } from "@/lib/prestige";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type AchievementCard = { data: Record<string, unknown>; description: string; key: string; title: string };

async function requireUser() {
  if (!isSupabaseAdminConfigured) return { error: "Supabase admin is not configured.", status: 500 } as const;
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();
  if (!data.user) return { error: "Sign in to share achievements.", status: 401 } as const;
  return { supabase: createSupabaseAdminClient(), user: data.user } as const;
}

async function getAchievementCards(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const goal = getCurrentCommunityGoal();
  const [profileResult, badgeResult, crateResult, shrineResult, contributionResult, sharedResult] = await Promise.all([
    supabase.from("profiles").select("user_level").eq("id", userId).maybeSingle(),
    supabase.from("user_prestige_badges").select("badge_id, earned_at").eq("user_id", userId).order("earned_at", { ascending: false }).limit(12),
    supabase.from("crate_opens").select("id, item_id, opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(100),
    supabase.from("coin_transactions").select("id, metadata, created_at").eq("user_id", userId).eq("reason", "tribute:shrine").order("created_at", { ascending: false }).limit(1),
    supabase.from("coin_transactions").select("id, amount, created_at").eq("user_id", userId).in("reason", goal.includedReasons).gte("created_at", goal.startsAt).lt("created_at", goal.endsAt).order("created_at", { ascending: false }).limit(1),
    supabase.from("principessa_posts").select("achievement_key").eq("author_id", userId).eq("post_type", "achievement"),
  ]);
  const failed = [profileResult.error, badgeResult.error, crateResult.error, shrineResult.error, contributionResult.error, sharedResult.error].find(Boolean);
  if (failed) throw failed;
  const cards: AchievementCard[] = [];
  for (const row of badgeResult.data ?? []) {
    const badge = inflateUserPrestigeBadge(row.badge_id, row.earned_at);
    if (badge) cards.push({ data: { badgeId: badge.id, tone: badge.tone }, description: `Earned the ${badge.label} badge.`, key: `badge:${badge.id}`, title: "New badge earned" });
  }
  const level = Number(profileResult.data?.user_level ?? 1);
  if (level >= 5) cards.push({ data: { level }, description: `Reached Vault Mistress level ${level}.`, key: `prestige:level:${level}`, title: "Prestige milestone" });
  const legendary = (crateResult.data ?? []).find((opening) => opening.item_id && SAMPLE_CRATE_ITEMS[opening.item_id]?.rarity === "legendary");
  if (legendary?.item_id) cards.push({ data: { itemId: legendary.item_id }, description: `Pulled ${SAMPLE_CRATE_ITEMS[legendary.item_id]?.name ?? legendary.item_id}, a legendary reward.`, key: `legendary:${legendary.id}`, title: "Legendary case opening" });
  const shrine = shrineResult.data?.[0];
  if (shrine) cards.push({ data: { transactionId: shrine.id }, description: "Reached a new Shrine contribution milestone.", key: `shrine:${shrine.id}`, title: "Shrine milestone" });
  const contribution = contributionResult.data?.[0];
  if (contribution) cards.push({ data: { contribution: Math.abs(Number(contribution.amount ?? 0)), goalId: goal.id }, description: `Contributed ${Math.abs(Number(contribution.amount ?? 0)).toLocaleString()} LP toward ${goal.title}.`, key: `community:${contribution.id}`, title: "Community goal contribution" });
  const shared = new Set((sharedResult.data ?? []).map((row) => row.achievement_key));
  return cards.map((card) => ({ ...card, shared: shared.has(card.key) }));
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try { return Response.json({ achievements: await getAchievementCards(auth.supabase, auth.user.id) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Achievements could not be loaded." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  const key = String(body?.key ?? "").trim();
  const cards = await getAchievementCards(auth.supabase, auth.user.id);
  const card = cards.find((item) => item.key === key && !item.shared);
  if (!card) return Response.json({ error: "This achievement is unavailable or was already shared." }, { status: 409 });
  const { error } = await auth.supabase.from("principessa_posts").insert({
    achievement_data: card.data, achievement_key: card.key, author_id: auth.user.id,
    channel: "sub", description: card.description, post_type: "achievement", status: "pending", title: card.title,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ message: "Achievement card was sent for Principessa approval." }, { status: 201 });
}
