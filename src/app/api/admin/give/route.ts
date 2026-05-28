import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

async function isAdminRequest(adminPassword?: string) {
  if (adminPassword && adminPassword === process.env.ADMIN_PASSWORD) {
    return true;
  }

  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();

  if (!data.user) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin command auth profile lookup failed", error);
    return false;
  }

  return (
    Boolean(profile?.is_admin) ||
    String(profile?.username ?? "").toLowerCase() === "@principessa2dfd"
  );
}

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
  if (!(await isAdminRequest(body.adminPassword))) {
    return Response.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const command = body.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);

  if (!giveMatch && !timeoutMatch) {
    return Response.json(
      { error: "Invalid command. Use: /give 500 @username or /timeout @username 30" },
      { status: 400 },
    );
  }

  const amount = giveMatch ? Number(giveMatch[1]) : Number(timeoutMatch?.[2]);
  const username = (giveMatch?.[2] ?? timeoutMatch?.[1] ?? "").toLowerCase();
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

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error: timeoutError } = await supabase
      .from("profiles")
      .update({ timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (timeoutError) {
      console.error("Admin timeout update failed", timeoutError);
      return Response.json({ error: timeoutError.message }, { status: 500 });
    }

    return Response.json({
      message: `${profile.username} timed out for ${timeoutMinutes} minutes.`,
      username: profile.username,
      timeoutUntil,
    });
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
