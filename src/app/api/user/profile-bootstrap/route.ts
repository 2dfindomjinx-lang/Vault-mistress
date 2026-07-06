import { profileSelect } from "@/lib/server-game-rules";
import { cleanUsernameCandidate } from "@/lib/supabase/client";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  avatarUrl?: string | null;
  // username is no longer accepted for generation; server derives unique site username from X metadata on first creation
};

const DEBT_OVERDUE_TIMEOUT_REASON = "debt_contract_overdue";
const DEBT_OVERDUE_TIMEOUT_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function getCurrentInstallmentRemaining(contract: Record<string, any>) {
  const currentInstallmentRemaining = Math.floor(Number(contract.current_installment_remaining ?? 0));

  if (Number.isInteger(currentInstallmentRemaining) && currentInstallmentRemaining > 0) {
    return currentInstallmentRemaining;
  }

  return Math.max(0, Math.floor(Number(contract.debt_amount ?? 0)));
}

async function syncDebtOverdueTimeoutIfNeeded(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  profile: Record<string, any>,
  nowIso: string,
) {
  const nowMs = Date.now();

  const { data: contract, error: contractError } = await supabase
    .from("pet_debt_contracts")
    .select("id, status, next_due_at, paid_periods, missed_periods, duration_periods, current_installment_remaining, debt_amount")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractError) {
    console.error("Debt timeout self-heal contract lookup failed", contractError);
    return profile;
  }

  const currentInstallmentNumber = contract
    ? Math.min(Number(contract.paid_periods ?? 0) + 1, Number(contract.duration_periods ?? 0))
    : 0;
  const currentInstallmentRemaining = contract ? getCurrentInstallmentRemaining(contract) : 0;
  const nextDueAtMs = contract ? new Date(String(contract.next_due_at ?? "")).getTime() : Number.NaN;
  const overdue =
    Boolean(contract) &&
    contract?.status === "active" &&
    Number.isFinite(nextDueAtMs) &&
    nextDueAtMs <= nowMs &&
    currentInstallmentRemaining > 0;
  const hasMissedCurrentInstallment =
    contract && Number(contract.missed_periods ?? 0) >= currentInstallmentNumber;
  const shouldMarkMissed = overdue && !hasMissedCurrentInstallment;
  const shouldKeepTimeout = overdue;
  const shouldClearTimeout =
    profile.timeout_reason === DEBT_OVERDUE_TIMEOUT_REASON &&
    profile.timeout_until &&
    !shouldKeepTimeout;

  if (shouldMarkMissed) {
    const { data: updatedContract, error: markMissedError } = await supabase
      .from("pet_debt_contracts")
      .update({
        missed_periods: Number(contract?.missed_periods ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", contract?.id)
      .eq("missed_periods", Number(contract?.missed_periods ?? 0))
      .select("id, status, next_due_at, paid_periods, missed_periods, duration_periods, current_installment_remaining, debt_amount")
      .maybeSingle();

    if (markMissedError) {
      console.error("Debt timeout sync mark-missed failed", markMissedError);
    } else if (updatedContract) {
      contract.missed_periods = updatedContract.missed_periods;
    }
  }

  const nextTimeoutReason = shouldKeepTimeout
    ? DEBT_OVERDUE_TIMEOUT_REASON
    : profile.timeout_reason === DEBT_OVERDUE_TIMEOUT_REASON
      ? null
      : profile.timeout_reason;
  const nextTimeoutUntil = shouldKeepTimeout
    ? new Date(
        Math.max(
          nowMs + DEBT_OVERDUE_TIMEOUT_MS,
          new Date(profile.timeout_until ?? 0).getTime(),
        ),
      ).toISOString()
    : profile.timeout_reason === DEBT_OVERDUE_TIMEOUT_REASON
      ? null
      : profile.timeout_until;

  if (
    nextTimeoutReason === (profile.timeout_reason ?? null) &&
    nextTimeoutUntil === (profile.timeout_until ?? null)
  ) {
    return profile;
  }

  const { data: healedProfile, error: healError } = await supabase
    .from("profiles")
    .update({
      timeout_reason: nextTimeoutReason,
      timeout_until: nextTimeoutUntil,
      updated_at: nowIso,
    })
    .eq("id", userId)
    .eq("timeout_reason", profile.timeout_reason)
    .eq("timeout_until", profile.timeout_until)
    .select(profileSelect)
    .maybeSingle();

  if (healError) {
    console.error("Debt timeout self-heal update failed", healError);
    return profile;
  }

  return healedProfile ?? profile;
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function normalizeTwitterHandle(metadata: any): string {
  const meta = metadata ?? {};
  const candidate =
    meta.screen_name ??
    meta.user_name ??
    meta.preferred_username ??
    meta.name ??
    meta.full_name ??
    "";
  return cleanUsernameCandidate(String(candidate));
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const metadata = authData.user.user_metadata ?? {};
  const twitterBase = normalizeTwitterHandle(metadata) || `vault_${authData.user.id.slice(0, 8)}`;
  const rawTwitterHandle =
    metadata.screen_name ??
    metadata.user_name ??
    metadata.preferred_username ??
    metadata.name ??
    metadata.full_name ??
    null;

  // Always check for existing profile by stable id (never by X handle)
  const { data: existing } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", authData.user.id)
    .maybeSingle();

  if (existing) {
    // Existing user: update twitter_handle if changed, login time. NEVER auto-rename username.
    const updates: Record<string, any> = {
      last_login_at: now,
      updated_at: now,
    };
    if (rawTwitterHandle && rawTwitterHandle !== (existing as any).twitter_handle) {
      updates.twitter_handle = rawTwitterHandle;
    }
    await supabase
      .from("profiles")
      .update(updates)
      .eq("id", authData.user.id);
    // Re-fetch to return fresh (may have updated twitter_handle)
    const { data: refreshed } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", authData.user.id)
      .single();
    const normalizedProfile = await syncDebtOverdueTimeoutIfNeeded(
      supabase,
      authData.user.id,
      (refreshed ?? existing) as Record<string, any>,
      now,
    );
    return Response.json({ profile: normalizedProfile });
  }

  // First time creation: derive unique site username from Twitter/X handle base
  // Stable identity is always the auth id. Site username is made unique here.
  let chosenUsername = `@${twitterBase}`;
  let suffix = 2;
  const MAX_TRIES = 200;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", chosenUsername)
      .maybeSingle();

    if (!taken) {
      break;
    }
    chosenUsername = `@${twitterBase}${suffix}`;
    suffix += 1;
  }

  // Create the profile with the unique site username + store the X handle separately
  const insertData: any = {
    affection: 0,
    avatar_url: body?.avatarUrl ?? null,
    coins: 100,
    id: authData.user.id,
    daily_purchase_count: 0,
    equipped_avatar_slots: { fullBody: "classic" },
    has_uncensored_avatar: false,
    last_login_at: now,
    owner_likeness: 100,
    pet_score: 0,
    right_expirations: [],
    right_purchase_date: null,
    stored_rights: 0,
    tribute_total: 0,
    updated_at: now,
    user_level: 1,
    user_xp: 0,
    username: chosenUsername,
    twitter_handle: rawTwitterHandle,
  };

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert(insertData)
    .select(profileSelect)
    .single();

  if (createError || !created) {
    // Fallback rare case: try with id suffix if unique violation on username
    if (createError?.code === "23505") {
      const fallback = `@${twitterBase}_${authData.user.id.slice(0, 6)}`;
      const { data: fb, error: fbErr } = await supabase
        .from("profiles")
        .insert({ ...insertData, username: fallback })
        .select(profileSelect)
        .single();
      if (fbErr || !fb) {
        return jsonError(fbErr?.message ?? "Profile could not be created.", 500);
      }
      // Seed default fullbody item definition + inventory for fallback
      try {
        await supabase.from("crate_items").upsert({
          item_id: "classic",
          name: "Classic",
          description: "The default full-body outfit. Simple and clean.",
          rarity: "common",
          collection: "classic",
          sell_value: 50,
          enabled: true,
          metadata: {},
        }, { onConflict: "item_id" });
        await supabase.from("user_crate_inventory").upsert(
          { user_id: authData.user.id, item_id: "classic", variant: "normal", quantity: 1 },
          { onConflict: "user_id,item_id,variant" }
        );
      } catch {
        // ignore inventory seed error
      }
      return Response.json({ profile: fb });
    }
    return jsonError(createError?.message ?? "Profile could not be created.", 500);
  }

  // Seed default "classic" fullbody item definition + unlocked + equipped for every new user
  try {
    await supabase.from("crate_items").upsert({
      item_id: "classic",
      name: "Classic",
      description: "The default full-body outfit. Simple and clean.",
      rarity: "common",
      collection: "classic",
      sell_value: 50,
      enabled: true,
      metadata: {},
    }, { onConflict: "item_id" });
    await supabase.from("user_crate_inventory").upsert(
      { user_id: authData.user.id, item_id: "classic", variant: "normal", quantity: 1 },
      { onConflict: "user_id,item_id,variant" }
    );
  } catch {
    // ignore inventory seed error
  }

  return Response.json({ profile: created });
}
