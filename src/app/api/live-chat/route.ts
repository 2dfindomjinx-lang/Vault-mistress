import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { sendAdminMobileChatPushOnce } from "@/lib/admin-mobile-push";

const CHAT_HIGHLIGHT_COST = 2000;
const CHAT_MAX_LENGTH = 250;
const CHAT_COOLDOWN_MS = 8000;

type ChatBody = {
  action?: "send" | "delete" | "mute";
  message?: string;
  messageId?: string;
  messageType?: string;
  mutedUntil?: string | null;
  reason?: string;
  userId?: string;
};

type ProfileRow = {
  avatar_url?: string | null;
  coins: number;
  display_name?: string | null;
  id: string;
  is_admin?: boolean | null;
  username: string;
};

type LiveChatMessageRow = {
  coin_cost?: number | null;
  created_at: string;
  deleted_at?: string | null;
  expires_at?: string | null;
  id: string;
  is_deleted?: boolean | null;
  message: string;
  message_type?: string | null;
  user_id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getAuthedUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: jsonError(authError?.message ?? "Authentication required.", 401), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

function sanitizeMessage(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH);
}

async function hydrateMessages(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  messages: LiveChatMessageRow[],
) {
  const userIds = Array.from(new Set(messages.map((message) => message.user_id)));

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", userIds);

  if (error) {
    console.warn("[live-chat] profile hydration failed", error);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

  return messages.map((message) => ({
    ...message,
    profiles: profileMap.get(message.user_id) ?? null,
  }));
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUser();
  if (authResult.error) return authResult.error;

  const supabase = createSupabaseAdminClient();
  const [profileResult, messagesResult, muteResult] = await Promise.all([
    supabase.from("profiles").select(profileSelect).eq("id", authResult.userId!).single(),
    supabase
      .from("live_chat_messages")
      .select("id, user_id, message, created_at, is_deleted, deleted_at, message_type, coin_cost, expires_at")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(75),
    supabase.from("live_chat_mutes").select("*").eq("user_id", authResult.userId!).maybeSingle(),
  ]);

  if (messagesResult.error) {
    return jsonError(messagesResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow | null;
  const mute = muteResult.data as { muted_until?: string | null; reason?: string | null } | null;
  const mutedUntilMs = mute?.muted_until ? new Date(mute.muted_until).getTime() : null;
  const isMuted = mutedUntilMs === null ? Boolean(mute) : mutedUntilMs > Date.now();
  const messages = await hydrateMessages(
    supabase,
    ((messagesResult.data ?? []) as LiveChatMessageRow[]).reverse(),
  );

  return Response.json({
    currentUser: {
      isAdmin: Boolean(profile?.is_admin),
      mutedReason: isMuted ? mute?.reason ?? "" : "",
      mutedUntil: isMuted ? mute?.muted_until ?? null : null,
    },
    messages,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUser();
  if (authResult.error) return authResult.error;

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const supabase = createSupabaseAdminClient();
  const userId = authResult.userId!;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const currentProfile = profile as ProfileRow;

  if (body?.action === "delete") {
    if (!currentProfile.is_admin || !body.messageId) {
      return jsonError("Admin access required.", 403);
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("live_chat_messages")
      .update({ deleted_at: now, deleted_by: userId, is_deleted: true })
      .eq("id", body.messageId);

    if (error) return jsonError(error.message, 500);
    return Response.json({ ok: true });
  }

  if (body?.action === "mute") {
    if (!currentProfile.is_admin || !body.userId) {
      return jsonError("Admin access required.", 403);
    }

    const { error } = await supabase.from("live_chat_mutes").upsert({
      created_at: new Date().toISOString(),
      muted_by: userId,
      muted_until: body.mutedUntil ?? null,
      reason: sanitizeMessage(body.reason),
      user_id: body.userId,
    });

    if (error) return jsonError(error.message, 500);
    return Response.json({ ok: true });
  }

  if (body?.action !== "send") {
    return jsonError("Invalid chat action.", 422);
  }

  const message = sanitizeMessage(body.message);
  if (!message) {
    return jsonError("Message cannot be empty.", 422);
  }

  const [muteResult, recentResult] = await Promise.all([
    supabase.from("live_chat_mutes").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("live_chat_messages")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const mute = muteResult.data as { muted_until?: string | null; reason?: string | null } | null;
  const mutedUntilMs = mute?.muted_until ? new Date(mute.muted_until).getTime() : null;

  if (mute && (mutedUntilMs === null || mutedUntilMs > Date.now())) {
    return jsonError("You are muted in Live Chat.", 403);
  }

  const lastCreatedAt = recentResult.data?.created_at ? new Date(recentResult.data.created_at).getTime() : 0;
  if (Date.now() - lastCreatedAt < CHAT_COOLDOWN_MS) {
    return jsonError("Chat cooldown is still active.", 429);
  }

  const messageType = body.messageType === "highlighted" ? "highlighted" : "normal";
  const coinCost = messageType === "highlighted" ? CHAT_HIGHLIGHT_COST : 0;
  const nextCoins = currentProfile.coins - coinCost;
  let spendTransactionId: string | null = null;

  if (coinCost > 0 && currentProfile.coins < coinCost) {
    return jsonError("Not enough coins for highlighted chat.", 402);
  }

  if (coinCost > 0) {
    const now = new Date().toISOString();
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", currentProfile.coins)
      .select(profileSelect)
      .maybeSingle();

    if (updateError || !updatedProfile) {
      return jsonError(updateError?.message ?? "Chat spend was stale.", updateError ? 500 : 409);
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("coin_transactions")
      .insert({
        amount: -coinCost,
        balance_after: nextCoins,
        balance_before: currentProfile.coins,
        metadata: { messageType, spendAmount: coinCost },
        reason: "spend:chat-highlight",
        user_id: userId,
      })
      .select("id")
      .maybeSingle();

    if (transactionError || !transaction) {
      await supabase.from("profiles").update({ coins: currentProfile.coins, updated_at: now }).eq("id", userId).eq("coins", nextCoins);
      return jsonError("Chat spend could not be logged.", 500);
    }

    spendTransactionId = transaction.id as string;
  }

  const { data: createdMessage, error: messageError } = await supabase
    .from("live_chat_messages")
    .insert({
      coin_cost: coinCost,
      message,
      message_type: messageType,
      user_id: userId,
    })
    .select("id, user_id, message, created_at, is_deleted, deleted_at, message_type, coin_cost, expires_at")
    .maybeSingle();

  if (messageError || !createdMessage) {
    if (coinCost > 0) {
      await supabase
        .from("profiles")
        .update({ coins: currentProfile.coins, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("coins", nextCoins);

      if (spendTransactionId) {
        await supabase.from("coin_transactions").delete().eq("id", spendTransactionId);
      }
    }

    return jsonError(messageError?.message ?? "Message could not be sent.", 500);
  }

  const [hydratedMessage] = await hydrateMessages(supabase, [createdMessage as LiveChatMessageRow]);
  if (!currentProfile.is_admin) {
    await sendAdminMobileChatPushOnce({
      body: `${currentProfile.display_name?.trim() || `@${currentProfile.username}`}: ${message}`,
      title: "New Live Chat message",
    }).catch((error) => console.error("Live Chat mobile push failed", error));
  }

  return Response.json({
    message: hydratedMessage,
    profile: coinCost > 0 ? { ...currentProfile, coins: nextCoins } : currentProfile,
  });
}
