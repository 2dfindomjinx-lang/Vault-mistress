import { isAddressTerm, normalizeAddressTerm } from "@/lib/address-term";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  addressTerm?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  // Accept only current keys; reject legacy boy/girl so clients migrate to sub/femsub.
  if (!isAddressTerm(body?.addressTerm)) {
    return jsonError("Invalid address term. Use sub, femsub, or neutral.", 400);
  }

  const addressTerm = normalizeAddressTerm(body.addressTerm);
  const supabase = createSupabaseAdminClient();
  const userId = authData.user.id;

  const { data: updated, error: updateErr } = await supabase
    .from("profiles")
    .update({ address_term: addressTerm, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select(profileSelect)
    .maybeSingle();

  if (updateErr || !updated) {
    return jsonError(updateErr?.message ?? "Failed to update address term.", 500);
  }

  return Response.json({ profile: updated });
}
