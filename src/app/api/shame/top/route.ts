import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type ProfileRow = {
  id: string;
  username: string;
  shame_count: number | null;
};

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Public shame board route is not configured", configErrors);
    return Response.json(
      { error: `Public shame board is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: overdueTasks, error: overdueError } = await supabase
    .from("user_irl_tasks")
    .select("id, user_id")
    .eq("status", "assigned")
    .lt("due_at", now)
    .is("shamed_at", null);

  if (overdueError) {
    console.error("Failed to load overdue shame tasks", overdueError);
    return Response.json({ error: overdueError.message }, { status: 500 });
  }

  const overdueByUser = new Map<string, number>();

  for (const task of overdueTasks ?? []) {
    overdueByUser.set(task.user_id, (overdueByUser.get(task.user_id) ?? 0) + 1);
  }

  if (overdueByUser.size > 0) {
    const userIds = Array.from(overdueByUser.keys());
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, shame_count")
      .in("id", userIds);

    if (profileError) {
      console.error("Failed to load profiles for shame update", profileError);
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      const increment = overdueByUser.get(profile.id) ?? 0;

      if (increment <= 0) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          shame_count: Number(profile.shame_count ?? 0) + increment,
          updated_at: now,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error("Failed to increment profile shame count", updateError);
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    }

    const overdueIds = (overdueTasks ?? []).map((task) => task.id);

    if (overdueIds.length > 0) {
      const { error: markError } = await supabase
        .from("user_irl_tasks")
        .update({ shamed_at: now })
        .in("id", overdueIds);

      if (markError) {
        console.error("Failed to mark overdue tasks as shamed", markError);
        return Response.json({ error: markError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("username, shame_count")
    .gt("shame_count", 0)
    .order("shame_count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Failed to load public shame board", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    shame: (data ?? []).map((profile) => ({
      shameCount: Number(profile.shame_count ?? 0),
      username: profile.username,
    })),
  });
}
