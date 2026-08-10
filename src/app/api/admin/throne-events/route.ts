import { requireAdminProfile } from "@/lib/admin-guard";

// How many rows of each kind to return. Unmatched events are the ones that
// need action, so they get the bigger slice.
const CREDITED_LIMIT = 40;
const UNMATCHED_LIMIT = 60;

export type ThroneEventRow = {
  eventId: string;
  status: string;
  occurredAt: string | null;
  amountUsd: number;
  eventType: string | null;
  message: string | null;
  attributionCode: string | null;
  userId: string | null;
  username: string | null;
  moneyAwarded: number | null;
};

type WebhookEventRow = {
  event_id: string;
  status: string;
  user_id: string | null;
  occurred_at: string | null;
  created_at: string;
  attribution_code: string | null;
  payload: {
    event_type?: string;
    data?: { amount?: unknown; price?: unknown; message?: unknown };
  } | null;
};

// Throne sends the smallest currency unit x100 (1099 = $10.99), under
// data.price for gifts/crowdfunded and data.amount for contributions.
function readAmountUsd(payload: WebhookEventRow["payload"]) {
  const raw = payload?.data?.price ?? payload?.data?.amount;
  const cents = Number(raw);
  return Number.isFinite(cents) && cents > 0 ? cents / 100 : 0;
}

function readMessage(payload: WebhookEventRow["payload"]) {
  const message = payload?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message.trim() : null;
}

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error ?? "Admin access required." }, { status: admin.status });
  }

  const supabase = admin.supabase;

  const [creditedResult, unmatchedResult] = await Promise.all([
    supabase
      .from("throne_webhook_events")
      .select("event_id, status, user_id, occurred_at, created_at, attribution_code, payload")
      .eq("status", "credited")
      .order("occurred_at", { ascending: false })
      .limit(CREDITED_LIMIT),
    // "failed" belongs with unmatched, not with the successes: the payment is
    // real and still owed, it just could not be written. Both need a human.
    supabase
      .from("throne_webhook_events")
      .select("event_id, status, user_id, occurred_at, created_at, attribution_code, payload")
      .in("status", ["unmatched", "failed"])
      .order("occurred_at", { ascending: false })
      .limit(UNMATCHED_LIMIT),
  ]);

  if (creditedResult.error || unmatchedResult.error) {
    const error = creditedResult.error ?? unmatchedResult.error;
    console.error("Admin Throne event lookup failed", error);
    return Response.json({ error: error?.message ?? "Throne event lookup failed." }, { status: 500 });
  }

  const credited = (creditedResult.data ?? []) as WebhookEventRow[];
  const unmatched = (unmatchedResult.data ?? []) as WebhookEventRow[];
  const allRows = [...credited, ...unmatched];

  // Two lookups rather than per-row queries: the PM actually awarded lives in
  // the ledger under a source_key of 'throne:<event_id>', and the handle lives
  // on profiles.
  const eventIds = allRows.map((row) => row.event_id);
  const userIds = Array.from(
    new Set(allRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  );

  const [ledgerResult, profileResult] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from("money_transactions")
          .select("amount, source_key")
          .in("source_key", eventIds.map((eventId) => `throne:${eventId}`))
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from("profiles").select("id, username").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ledgerResult.error) {
    console.error("Admin Throne ledger lookup failed", ledgerResult.error);
  }
  if (profileResult.error) {
    console.error("Admin Throne profile lookup failed", profileResult.error);
  }

  const awardedBySourceKey = new Map(
    ((ledgerResult.data ?? []) as Array<{ amount: number | null; source_key: string | null }>)
      .filter((row) => Boolean(row.source_key))
      .map((row) => [row.source_key as string, Math.max(0, Number(row.amount ?? 0))]),
  );
  const usernameById = new Map(
    ((profileResult.data ?? []) as Array<{ id: string; username: string | null }>).map((row) => [
      row.id,
      row.username,
    ]),
  );

  const toRow = (row: WebhookEventRow): ThroneEventRow => ({
    amountUsd: readAmountUsd(row.payload),
    attributionCode: row.attribution_code,
    eventId: row.event_id,
    eventType: row.payload?.event_type ?? null,
    message: readMessage(row.payload),
    moneyAwarded: awardedBySourceKey.get(`throne:${row.event_id}`) ?? null,
    occurredAt: row.occurred_at ?? row.created_at,
    status: row.status,
    userId: row.user_id,
    username: row.user_id ? usernameById.get(row.user_id) ?? null : null,
  });

  return Response.json(
    {
      credited: credited.map(toRow),
      unmatched: unmatched.map(toRow),
      // Unattributed money is the number worth watching: it is real revenue the
      // site could not hand to anyone.
      unmatchedTotalUsd: unmatched.reduce((sum, row) => sum + readAmountUsd(row.payload), 0),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
