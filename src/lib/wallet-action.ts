import { profileSelect } from "./profile-columns";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const validWalletRequestId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function executeWalletAction(db: ReturnType<typeof createSupabaseAdminClient>, userId: string, requestId: string, operation: "money-convert" | "furnace" | "shrine", amount: number) {
  const { data: result, error } = await db.rpc("execute_wallet_action", { p_user_id: userId, p_request_id: requestId, p_operation: operation, p_amount: amount });
  if (error || !result) {
    console.error(`[${operation}] transaction unavailable`, error);
    return { response: Response.json({ error: "Your transaction could not be confirmed. Retry to check it." }, { status: 503 }) };
  }
  if (result.error) {
    const messages: Record<string, string> = { insufficient_money: "Not enough Principessa Money.", insufficient_coins: "Not enough Coins.", shrine_locked: "The Shrine unlocks at 100 Affection.", balance_limit: "This conversion would exceed the Coin balance limit.", request_mismatch: "This request was already used for a different amount." };
    return { response: Response.json({ error: messages[result.error] ?? "This transaction is unavailable." }, { status: result.error.startsWith("insufficient_") ? 402 : 409 }) };
  }
  const { data: profile, error: profileError } = await db.from("profiles").select(profileSelect).eq("id", userId).single();
  if (profileError || !profile) return { response: Response.json({ error: "Your transaction was recorded. Retry to refresh your balance." }, { status: 503 }) };
  return { result, profile };
}
