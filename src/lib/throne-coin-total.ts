import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadThroneCoinTotal(db: SupabaseClient, userId: string) {
  const result = await db.rpc("my_throne_coin_total");
  if (result.error?.code !== "PGRST202") return result;

  // Safe rollout when application deployment precedes the SQL. Paginate the
  // old read so a long transaction history isn't truncated at the API row cap.
  let total = 0;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("coin_transactions")
      .select("amount, metadata, reason").eq("user_id", userId)
      .in("reason", ["throne_tribute", "live_gift"])
      .order("id").range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    for (const entry of data ?? []) {
      const metadata = entry.metadata ?? {};
      if (entry.reason === "throne_tribute" || metadata.command === "give" || metadata.kind === "manual_coin_purchase" || metadata.source === "throne") {
        total += Math.max(0, Number(entry.amount ?? 0));
      }
    }
    if (!data || data.length < pageSize) return { data: total, error: null };
  }
}
