import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const configErrors = [
    ...getSupabaseAdminConfigErrors(),
    !process.env.ADMIN_PASSWORD ? "ADMIN_PASSWORD is missing" : "",
  ].filter(Boolean);

  if (!isSupabaseAdminConfigured || !process.env.ADMIN_PASSWORD) {
    console.error("Admin Supabase route is not configured", configErrors);
    return Response.json(
      {
        error: `Admin Supabase environment is not configured: ${configErrors.join(", ")}`,
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    adminPassword?: string;
    command?: string;
  };

  // MVP only: replace shared env-password admin access with secure backend auth
  // before production.
  if (body.adminPassword !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const match = body.command
    ?.trim()
    .match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);

  if (!match) {
    return Response.json(
      { error: "Invalid command. Use: /give 500 @username" },
      { status: 400 },
    );
  }

  const amount = Number(match[1]);
  const username = match[2].toLowerCase();
  const supabase = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, coins")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return Response.json(
      { error: "User not found in Supabase profiles." },
      { status: 404 },
    );
  }

  const nextCoins = Number(profile.coins ?? 0) + amount;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Admin coin update failed", updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    user_id: profile.id,
    amount,
    reason: "admin:/give",
  });

  if (transactionError) {
    console.error("Admin coin transaction insert failed", transactionError);
  }

  return Response.json({
    message: `Added ${amount} coins to ${profile.username}.`,
    username: profile.username,
    coins: nextCoins,
  });
}
