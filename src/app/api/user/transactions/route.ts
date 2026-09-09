import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured)
    return Response.json(
      { error: "History is temporarily unavailable." },
      { status: 503 },
    );
  const auth = await createClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user)
    return Response.json(
      { error: "Sign in to view your history." },
      { status: 401 },
    );
  const currency =
    new URL(request.url).searchParams.get("currency") === "PM" ? "PM" : "Coin";
  const db = createSupabaseAdminClient();
  const result = await db
    .from(currency === "PM" ? "money_transactions" : "coin_transactions")
    .select("id,amount,balance_after,reason,created_at")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (result.error)
    return Response.json(
      { error: "Your history could not be loaded. Try again." },
      { status: 503 },
    );
  return Response.json(
    { currency, transactions: result.data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
