import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = await request.json().catch(() => null);
  const fcmToken = typeof body?.fcm_token === "string" ? body.fcm_token.trim() : "";

  if (!fcmToken || fcmToken.length < 20 || fcmToken.length > 4096) {
    return Response.json({ error: "Invalid FCM token" }, { status: 400 });
  }

  const { error } = await admin.supabase.from("admin_mobile_device_tokens").upsert(
    {
      admin_user_id: admin.adminUser.id,
      fcm_token: fcmToken,
      platform: "android",
      notifications_enabled: body?.notifications_enabled !== false,
      important_only: body?.important_only === true,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "fcm_token" },
  );

  if (error) {
    console.error("Mobile device registration failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
