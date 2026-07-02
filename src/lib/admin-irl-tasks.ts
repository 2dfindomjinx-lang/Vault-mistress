import type { SupabaseClient } from "@supabase/supabase-js";

type AdminIrlTaskProfileRow = {
  id: string;
  timeout_until: string | null;
  username: string;
};

export async function listAdminIrlTasks<T extends { user_id: string }>(
  supabase: SupabaseClient,
  options: { limit: number; select: string },
): Promise<Array<T & { timeout_until: string | null; username: string }>> {
  const { data, error } = await supabase
    .from("user_irl_tasks")
    .select(options.select)
    .eq("status", "assigned")
    .order("assigned_at", { ascending: false })
    .limit(options.limit);

  if (error) {
    console.error("Admin IRL task list failed", error);
    throw error;
  }

  const rows = ((data ?? []) as unknown) as T[];

  if (rows.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, timeout_until")
    .in("id", userIds);

  if (profileError) {
    console.error("Admin IRL task profile lookup failed", profileError);
  }

  const profileMap = new Map(
    ((profiles ?? []) as AdminIrlTaskProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return rows.map((entry) => {
    const profile = profileMap.get(entry.user_id);

    return {
      ...entry,
      timeout_until: profile?.timeout_until ?? null,
      username: profile?.username ?? "@unknown",
    };
  });
}
