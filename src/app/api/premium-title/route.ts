import { PREMIUM_TITLE_ID, type PremiumTitleConfig } from "@/lib/premium-title";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

function fallback(): PremiumTitleConfig {
  return {
    id: PREMIUM_TITLE_ID,
    name: "Principessa's Leaking Toy",
    description: "A premium title bought from the cosmetic shop.",
    price: 50000,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    next: null,
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) return Response.json({ premiumTitle: fallback() });
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase.from("premium_title_config").select("*").eq("id", true).maybeSingle();
  if (error || !data) return Response.json({ premiumTitle: fallback() });

  const now = new Date();
  const currentExpired = new Date(data.current_expires_at).getTime() <= now.getTime();
  const nextReady = data.next_name && (!data.next_starts_at || new Date(data.next_starts_at).getTime() <= now.getTime());
  if (currentExpired && nextReady) {
    const nextExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const promoted = {
      current_name: data.next_name,
      current_description: data.next_description ?? "A rotating premium title.",
      current_price: data.next_price ?? 50000,
      current_expires_at: nextExpires,
      next_name: null,
      next_description: null,
      next_price: null,
      next_starts_at: null,
      updated_at: now.toISOString(),
    };
    const { data: updated } = await supabase.from("premium_title_config").update(promoted).eq("id", true).select("*").single();
    if (updated) data = updated;
  }

  const premiumTitle: PremiumTitleConfig = {
    id: PREMIUM_TITLE_ID,
    name: data.current_name,
    description: data.current_description,
    price: Number(data.current_price),
    expiresAt: data.current_expires_at,
    next: data.next_name ? {
      name: data.next_name,
      description: data.next_description ?? "A rotating premium title.",
      price: Number(data.next_price ?? 50000),
      startsAt: data.next_starts_at,
    } : null,
  };
  return Response.json({ premiumTitle }, { headers: { "Cache-Control": "no-store" } });
}
