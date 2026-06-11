import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => null)) as { command?: string } | null;
  const command = body?.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const addMatch = command.match(/^\/add\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);
  const timeoutRemoveMatch = command.match(/^\/timeout\s+remove\s+(@[A-Za-z0-9_.-]+)$/);

  if (!giveMatch && !addMatch && !timeoutMatch && !timeoutRemoveMatch) {
    return Response.json(
      { error: "Use /give 500 @username, /add 500 @username, /timeout @username 30, or /timeout remove @username" },
      { status: 400 },
    );
  }

  const username = (giveMatch?.[2] ?? addMatch?.[2] ?? timeoutMatch?.[1] ?? timeoutRemoveMatch?.[1] ?? "").toLowerCase();
  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, username, coins")
    .eq("username", username)
    .maybeSingle();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!profile) return Response.json({ error: "User not found." }, { status: 404 });

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timed out for ${timeoutMinutes} minutes.` });
  }

  if (timeoutRemoveMatch) {
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_until: null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timeout removed.` });
  }

  const amount = Number(giveMatch?.[1] ?? addMatch?.[1]);
  const previousCoins = Number(profile.coins ?? 0);
  const nextCoins = previousCoins + amount;
  const reason = giveMatch ? "throne_tribute" : "admin_add";

  const { error: updateError } = await admin.supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  const { error: transactionError } = await admin.supabase.from("coin_transactions").insert({
    user_id: profile.id,
    admin_user_id: admin.adminUser.id,
    amount,
    reason,
    balance_before: previousCoins,
    balance_after: nextCoins,
    metadata: {
      command: giveMatch ? "give" : "add",
      source: "mobile_admin",
    },
  });

  if (transactionError) {
    await admin.supabase.from("profiles").update({ coins: previousCoins }).eq("id", profile.id).eq("coins", nextCoins);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  return Response.json({ message: `${giveMatch ? "Granted" : "Added"} ${amount} coins to ${profile.username}.` });
}
