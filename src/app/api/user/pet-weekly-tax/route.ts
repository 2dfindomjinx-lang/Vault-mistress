import { profileSelect } from "@/lib/profile-columns";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Service unavailable." }, { status: 503 });
  const auth = await createClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const db = createSupabaseAdminClient();
  const limit = await checkRateLimit(db, `pet-tax:${data.user.id}`, 15, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  const { data: result, error: rpcError } = await db.rpc("apply_pet_action", { p_user_id: data.user.id, p_action: "spend:pet-weekly-tax" });
  if (rpcError || !result) return Response.json({ error: "Weekly tax could not be confirmed." }, { status: 503 });
  const { data: profile, error: readError } = await db.from("profiles").select(profileSelect).eq("id", data.user.id).single();
  if (readError || !profile) return Response.json({ error: "Refresh to see your balance." }, { status: 503 });
  if (result.error && result.error !== "pet_locked") return Response.json({ error: "Weekly tax is unavailable." }, { status: 409 });
  return Response.json({ ...result, collected: Boolean(result.collected), profile }, { headers: { "Cache-Control": "private, no-store" } });
}