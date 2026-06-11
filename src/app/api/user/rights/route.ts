import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  action?: "buy" | "use";
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  if (body?.action !== "buy" && body?.action !== "use") {
    return jsonError("Invalid rights action.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("perform_rights_action", {
    p_action: body.action,
    p_user_id: authData.user.id,
  });

  if (error) {
    console.error("Rights action RPC failed", { action: body.action, code: error.code, message: error.message });
    return jsonError(error.message || "Rights action failed.", 500);
  }

  return Response.json({ result: data });
}
