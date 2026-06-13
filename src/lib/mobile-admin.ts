import { isTrustedAdminUserId, normalizeAdminUsername } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireMobileAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!jwt) {
    return { error: "Missing bearer token", status: 401 } as const;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data.user) {
    return { error: "Invalid session", status: 401 } as const;
  }

  if (!isTrustedAdminUserId(data.user.id)) {
    return { error: "Admin access only.", status: 403 } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 } as const;
  }

  return {
    adminUser: data.user,
    adminProfile: {
      id: profile?.id ?? data.user.id,
      username: normalizeAdminUsername(profile?.username ?? null),
    },
    supabase,
  } as const;
}
