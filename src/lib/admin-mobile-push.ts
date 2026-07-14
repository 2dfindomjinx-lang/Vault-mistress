import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function firebasePrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function getFirebaseMessaging() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: firebasePrivateKey(),
      }),
    });
  }

  return getMessaging();
}

export async function sendAdminMobilePush(input: {
  title: string;
  body: string;
  type: "irl_task" | "pet_task" | "debt" | "admin" | "principessa_post" | "live_chat";
  important?: boolean;
}) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn("Firebase Admin env is not configured; skipping mobile push.");
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_mobile_device_tokens")
    .select("fcm_token, important_only")
    .eq("platform", "android")
    .eq("notifications_enabled", true)
    .is("revoked_at", null);

  if (error) {
    console.error("Admin mobile device token lookup failed", error);
    return;
  }

  const tokens = (data ?? [])
    .filter((device) => !device.important_only || input.important)
    .map((device) => device.fcm_token)
    .filter(Boolean);

  if (!tokens.length) return;

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: input.title,
      body: input.body,
    },
    data: {
      type: input.type,
      important: String(Boolean(input.important)),
    },
    android: {
      priority: input.important ? "high" : "normal",
      notification: {
        channelId: "admin_alerts",
      },
    },
  });

  const invalidTokens = result.responses
    .map((response, index) => ({ response, token: tokens[index] }))
    .filter(({ response }) => {
      const code = response.error?.code;
      return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
    })
    .map(({ token }) => token);

  if (invalidTokens.length) {
    await supabase
      .from("admin_mobile_device_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .in("fcm_token", invalidTokens);
  }
}

export async function sendAdminMobileChatPushOnce(input: { body: string; title: string }) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_mobile_device_tokens")
    .update({ chat_notification_pending: true })
    .eq("platform", "android")
    .eq("notifications_enabled", true)
    .eq("important_only", false)
    .eq("chat_notification_pending", false)
    .is("revoked_at", null)
    .select("fcm_token");
  if (error) {
    console.error("Live Chat mobile notification claim failed", error);
    return;
  }
  const tokens = (data ?? []).map((row) => String(row.fcm_token)).filter(Boolean);
  if (!tokens.length) return;
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: input.title, body: input.body },
    data: { type: "live_chat", important: "false" },
    android: { priority: "normal", notification: { channelId: "admin_alerts" } },
  });
  const retryTokens = result.responses.flatMap((response, index) => response.success ? [] : [tokens[index]]);
  if (retryTokens.length > 0) {
    await supabase.from("admin_mobile_device_tokens").update({ chat_notification_pending: false }).in("fcm_token", retryTokens);
  }
}

export async function markAdminMobileChatRead(adminUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_mobile_device_tokens")
    .update({ chat_last_read_at: new Date().toISOString(), chat_notification_pending: false })
    .eq("admin_user_id", adminUserId)
    .is("revoked_at", null);
  if (error) throw error;
}
