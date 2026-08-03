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
  const { data: initialData, error } = await supabase.from("premium_title_config").select("*").eq("id", true).maybeSingle();
  if (error || !initialData) return Response.json({ premiumTitle: fallback() });
  let data = initialData;

  const now = new Date();
  const currentExpired = new Date(data.current_expires_at).getTime() <= now.getTime();
  const manualNextReady = data.next_name && (!data.next_starts_at || new Date(data.next_starts_at).getTime() <= now.getTime());
  const nextExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (currentExpired && manualNextReady) {
    // A one-off manual override takes priority over the pool for exactly
    // this rotation. current_pool_id is left untouched so the pool resumes
    // from wherever it left off once this manual title also expires.
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
  } else if (currentExpired) {
    // No manual override queued - auto-advance to the next enabled pool
    // entry (sort_order, wrapping around) instead of freezing forever.
    const { data: poolEntries } = await supabase
      .from("premium_title_pool")
      .select("id, name, description, price")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (poolEntries && poolEntries.length > 0) {
      const currentIndex = data.current_pool_id
        ? poolEntries.findIndex((entry) => entry.id === data.current_pool_id)
        : -1;
      const nextEntry = poolEntries[(currentIndex + 1) % poolEntries.length];
      const promoted = {
        current_name: nextEntry.name,
        current_description: nextEntry.description,
        current_price: nextEntry.price,
        current_expires_at: nextExpires,
        current_pool_id: nextEntry.id,
        updated_at: now.toISOString(),
      };
      const { data: updated } = await supabase.from("premium_title_config").update(promoted).eq("id", true).select("*").single();
      if (updated) data = updated;
    } else {
      // Pool is completely empty - don't freeze forever, extend the current
      // offer a short while so this gets retried rather than stuck forever.
      console.warn("[premium-title] pool is empty, extending current offer");
      const extended = {
        current_expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: now.toISOString(),
      };
      const { data: updated } = await supabase.from("premium_title_config").update(extended).eq("id", true).select("*").single();
      if (updated) data = updated;
    }
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
