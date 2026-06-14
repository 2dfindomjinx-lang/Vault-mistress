import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

export async function requireAdminProfile() {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin Supabase route is not configured", configErrors);
    return {
      error: `Admin Supabase environment is not configured: ${configErrors.join(", ")}`,
      status: 500,
    } as const;
  }

  const authSupabase = await createSupabaseServerClient();
  const { data, error: userError } = await authSupabase.auth.getUser();

  if (userError) {
    console.error("Admin auth user lookup failed", userError);
    return { error: userError.message, status: 401 } as const;
  }

  if (!data.user) {
    return { error: "Admin access required.", status: 401 } as const;
  }

  if (!isTrustedAdminUserId(data.user.id)) {
    return { error: "Admin access required.", status: 401 } as const;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin profile lookup failed", error);
    return { error: error.message, status: 500 } as const;
  }

  return { adminUser: data.user, adminProfile: profile, supabase } as const;
}

export const requireAdmin = requireAdminProfile;
