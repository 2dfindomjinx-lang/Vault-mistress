import { sendAdminMobilePush } from "@/lib/admin-mobile-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminCoinCommand = "give" | "add";

const LARGE_ADMIN_COIN_AMOUNT = Number(process.env.ADMIN_SECURITY_LARGE_COIN_AMOUNT ?? 50000);
const ADMIN_BURST_COUNT = Number(process.env.ADMIN_SECURITY_BURST_COUNT ?? 3);
const ADMIN_BURST_WINDOW_MINUTES = Number(process.env.ADMIN_SECURITY_BURST_WINDOW_MINUTES ?? 10);

export async function maybeSendAdminCoinSecurityPush(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    command: AdminCoinCommand;
    amount: number;
    username: string;
    transactionId?: string | null;
  },
) {
  try {
    const commandLabel = input.command === "give" ? "/give" : "/add";

    if (Number(input.amount) >= LARGE_ADMIN_COIN_AMOUNT) {
      await sendAdminMobilePush({
        title: "Suspicious admin coin command",
        body: `${commandLabel} ${input.amount.toLocaleString()} coins for ${input.username}.`,
        type: "admin",
        important: true,
      });
    }

    const burst = await getRecentAdminCoinBurst(supabase);

    if (burst.count >= ADMIN_BURST_COUNT) {
      await sendAdminMobilePush({
        title: "Rapid admin coin activity",
        body: `${burst.count} /give or /add commands in ${ADMIN_BURST_WINDOW_MINUTES} minutes. Total: ${burst.totalAmount.toLocaleString()} coins.`,
        type: "admin",
        important: true,
      });
    }
  } catch (error) {
    console.error("Admin coin security push failed", error);
  }
}

async function getRecentAdminCoinBurst(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const since = new Date(Date.now() - ADMIN_BURST_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("amount, reason, metadata, admin_user_id")
    .in("reason", ["admin_add", "throne_tribute"])
    .gt("amount", 0)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Admin coin burst lookup failed", error);
    return { count: 0, totalAmount: 0 };
  }

  const rows = (data ?? []).filter((row) => {
    const command = typeof row.metadata?.command === "string" ? row.metadata.command : "";
    return (
      row.admin_user_id
      && ((row.reason === "admin_add" && command === "add") || (row.reason === "throne_tribute" && command === "give"))
    );
  });

  return {
    count: rows.length,
    totalAmount: rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  };
}
