import { requireAdminProfile } from "@/lib/admin-guard";

// How many rows of each kind to return. Unmatched events are the ones that
// need action, so they get the bigger slice.
const CREDITED_LIMIT = 40;
const UNMATCHED_LIMIT = 60;
const IGNORED_LIMIT = 30;

// Only these can be dismissed. A "credited" row must never become 'ignored':
// the money is already in someone's balance, and hiding the event would drop it
// out of the tribute goal and the birthday cake while the payout stays. If a
// real credit needs undoing, that is a refund, not a dismissal.
const DISMISSABLE_STATUSES = ["unmatched", "failed"] as const;

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

  const [creditedResult, unmatchedResult, ignoredResult] = await Promise.all([
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
      .in("status", DISMISSABLE_STATUSES)
      .order("occurred_at", { ascending: false })
      .limit(UNMATCHED_LIMIT),
    supabase
      .from("throne_webhook_events")
      .select("event_id, status, user_id, occurred_at, created_at, attribution_code, payload")
      .eq("status", "ignored")
      .order("occurred_at", { ascending: false })
      .limit(IGNORED_LIMIT),
  ]);

  const listError = creditedResult.error ?? unmatchedResult.error ?? ignoredResult.error;
  if (listError) {
    console.error("Admin Throne event lookup failed", listError);
    return Response.json({ error: listError.message ?? "Throne event lookup failed." }, { status: 500 });
  }

  const credited = (creditedResult.data ?? []) as WebhookEventRow[];
  const unmatched = (unmatchedResult.data ?? []) as WebhookEventRow[];
  const ignored = (ignoredResult.data ?? []) as WebhookEventRow[];
  const allRows = [...credited, ...unmatched, ...ignored];

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
      ignored: ignored.map(toRow),
      unmatched: unmatched.map(toRow),
      // Unattributed money is the number worth watching: it is real revenue the
      // site could not hand to anyone.
      unmatchedTotalUsd: unmatched.reduce((sum, row) => sum + readAmountUsd(row.payload), 0),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Dismiss (or restore) an unattributed event.
 *
 * This sets `status = 'ignored'` rather than deleting the row, and that choice
 * is load-bearing in three places:
 *
 *   1. Idempotency. The webhook dedupes on throne_webhook_events.event_id. Delete
 *      the row and a Throne re-delivery of the same event is processed as brand
 *      new, which for a real payment would mean a second credit.
 *   2. supabase/tribute-goal.sql sums every event `where status <> 'ignored'`.
 *   3. supabase/birthday-2026.sql filters the cake the same way.
 *
 * So 'ignored' is exactly the semantics wanted for a Throne test webhook: it
 * disappears from the queue AND stops inflating the all-time goal and the cake,
 * while the id stays claimed. A DELETE would do the first and break the rest.
 */
export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error ?? "Admin access required." }, { status: admin.status });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    eventId?: string;
  } | null;
  const action = body?.action === "restore" ? "restore" : "ignore";
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return Response.json({ error: "Missing event id." }, { status: 400 });
  }

  const supabase = admin.supabase;
  const { data: event, error: lookupError } = await supabase
    .from("throne_webhook_events")
    .select("event_id, status")
    .eq("event_id", eventId)
    .maybeSingle<{ event_id: string; status: string }>();

  if (lookupError) {
    console.error("Admin Throne event dismiss lookup failed", lookupError);
    return Response.json({ error: lookupError.message }, { status: 500 });
  }
  if (!event) {
    return Response.json({ error: "Throne event not found." }, { status: 404 });
  }

  const nextStatus = action === "restore" ? "unmatched" : "ignored";
  const allowedFrom: readonly string[] =
    action === "restore" ? ["ignored"] : DISMISSABLE_STATUSES;

  if (!allowedFrom.includes(event.status)) {
    return Response.json(
      {
        error:
          action === "restore"
            ? "Only a dismissed event can be restored."
            : "Only an unmatched or failed event can be dismissed. A credited tribute has already been paid out.",
      },
      { status: 409 },
    );
  }

  // Guarded on the current status so two admins clicking at once cannot flip it
  // twice, matching the compare-and-swap style used elsewhere.
  const { data: updated, error: updateError } = await supabase
    .from("throne_webhook_events")
    .update({ processed_at: new Date().toISOString(), status: nextStatus })
    .eq("event_id", eventId)
    .eq("status", event.status)
    .select("event_id")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("Admin Throne event dismiss failed", updateError);
    return Response.json(
      { error: updateError?.message ?? "Event changed underneath you, refresh and try again." },
      { status: updateError ? 500 : 409 },
    );
  }

  // Keep the claim row in step. Best effort: the event status is what every
  // reader actually filters on, so a stale claim is cosmetic.
  const { error: claimError } = await supabase
    .from("tribute_claims")
    .update({ status: action === "restore" ? "unmatched" : "ignored" })
    .eq("event_id", eventId);
  if (claimError) {
    console.error("Admin Throne claim status sync failed", claimError);
  }

  return Response.json({
    message: action === "restore" ? "Event restored to the queue." : "Event dismissed.",
    status: nextStatus,
  });
}
