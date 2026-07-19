import {
  PRINCIPESSA_WALLPAPER_APP_KEY,
  normalizeLicenseCode,
  verifySignedLicenseToken,
} from "@/lib/app-licenses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MessageBody = {
  message?: string;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function requireWallpaperLicense(request: Request) {
  const payload = verifySignedLicenseToken(bearerToken(request));
  if (!payload || payload.appKey !== PRINCIPESSA_WALLPAPER_APP_KEY) {
    return { error: "Valid wallpaper activation is required.", status: 401 } as const;
  }

  const supabase = createSupabaseAdminClient();
  const { data: license, error } = await supabase
    .from("app_activation_codes")
    .select("id, status, bound_installation_id, owner_name")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("activation_code", normalizeLicenseCode(payload.activationCode))
    .maybeSingle();
  if (error) {
    return { error: error.message, status: 500 } as const;
  }
  if (
    !license ||
    license.status !== "active" ||
    license.bound_installation_id !== payload.installationId ||
    license.owner_name !== payload.ownerName
  ) {
    return { error: "Wallpaper activation is no longer valid.", status: 403 } as const;
  }

  return { supabase, license } as const;
}

async function loadMessages(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  activationId: string,
) {
  const { data, error } = await supabase
    .from("wallpaper_live_messages")
    .select("id, activation_id, scope, message, version, sender_role, created_at")
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .or(`activation_id.eq.${activationId},scope.eq.global`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function GET(request: Request) {
  const auth = await requireWallpaperLicense(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    return Response.json(
      { messages: await loadMessages(auth.supabase, auth.license.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Messages could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireWallpaperLicense(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as MessageBody;
  const message = body.message?.trim() ?? "";
  if (!message || message.length > 240) {
    return Response.json({ error: "Message must contain 1 to 240 characters." }, { status: 400 });
  }

  try {
    const { error } = await auth.supabase.from("wallpaper_live_messages").insert({
      app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
      activation_id: auth.license.id,
      scope: "device",
      message,
      version: randomUUID(),
      sender_role: "sub",
      active: false,
      created_by: null,
    });
    if (error) throw error;

    return Response.json({
      ok: true,
      messages: await loadMessages(auth.supabase, auth.license.id),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Message could not be sent." },
      { status: 500 },
    );
  }
}
