import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
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

async function sendWallpaperPush(input: {
  activationId: string | null;
  type: "wallpaper_live_message" | "wallpaper_sync";
  version: string;
}) {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn("Firebase Admin env is not configured; wallpaper sync will use polling fallback.");
      return;
    }

    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("wallpaper_device_push_registrations")
      .select("firebase_installation_id")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("platform", "android")
      .is("revoked_at", null);
    if (input.activationId) {
      query = query.eq("activation_id", input.activationId);
    }
    const { data, error } = await query;
    if (error) throw error;

    const installationIds = [
      ...new Set((data ?? []).map((row) => String(row.firebase_installation_id)).filter(Boolean)),
    ];
    for (let offset = 0; offset < installationIds.length; offset += 500) {
      const batch = installationIds.slice(offset, offset + 500);
      const result = await messaging.sendEachForMulticast({
        fids: batch,
        data: {
          type: input.type,
          version: input.version,
        },
        android: {
          priority: "high",
        },
      });

      const invalidInstallationIds = result.responses
        .flatMap((response, index) => {
          const code = response.error?.code;
          return code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
            ? [batch[index]]
            : [];
        });
      if (invalidInstallationIds.length > 0) {
        await supabase
          .from("wallpaper_device_push_registrations")
          .update({ revoked_at: new Date().toISOString() })
          .in("firebase_installation_id", invalidInstallationIds);
      }
    }
  } catch (error) {
    console.error("Wallpaper push failed; polling fallback remains active.", error);
  }
}

export async function sendWallpaperLiveMessagePush(input: {
  activationId: string | null;
  messageVersion: string;
}) {
  return sendWallpaperPush({
    activationId: input.activationId,
    type: "wallpaper_live_message",
    version: input.messageVersion,
  });
}

export async function sendWallpaperSyncPush(input: {
  activationId: string | null;
  wallpaperVersion: string;
}) {
  return sendWallpaperPush({
    activationId: input.activationId,
    type: "wallpaper_sync",
    version: input.wallpaperVersion,
  });
}
