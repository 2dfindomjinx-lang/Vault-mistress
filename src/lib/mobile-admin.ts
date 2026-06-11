import { isTrustedAdminUsername, normalizeAdminUsername } from "@/lib/admin-identity";
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 } as const;
  }

  if (!profile?.username || !isTrustedAdminUsername(profile.username)) {
    return { error: "Admin access only.", status: 403 } as const;
  }

  return {
    adminUser: data.user,
    adminProfile: {
      ...profile,
      username: normalizeAdminUsername(profile.username),
    },
    supabase,
  } as const;
}
