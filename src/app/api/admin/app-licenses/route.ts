import { requireAdminProfile } from "@/lib/admin-guard";
import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
  PRINCIPESSA_WALLPAPER_APP_KEY,
  isSupportedAppLicenseKey,
  insertAppLicense,
  listAppLicenseEvents,
  listAppLicenses,
  resetAppLicense,
  revokeAppLicense,
} from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  action?: "generate" | "revoke" | "reset" | "list";
  licenseId?: string;
  notes?: string;
  appKey?: string;
};

function requestedAppKey(value: string | null | undefined) {
  const appKey = value?.trim() || PRINCIPESSA_DISCIPLINE_APP_KEY;
  return isSupportedAppLicenseKey(appKey) ? appKey : null;
}

export async function GET(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const appKey = requestedAppKey(new URL(request.url).searchParams.get("appKey"));
  if (!appKey) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }

  try {
    return Response.json({
      appKey,
      licenses: await listAppLicenses(appKey),
      events: await listAppLicenseEvents(appKey),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "App license list failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Body;
  const appKey = requestedAppKey(body.appKey);
  if (!appKey) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }

  try {
    if (body.action === "list") {
      return Response.json({
        licenses: await listAppLicenses(appKey),
        events: await listAppLicenseEvents(appKey),
      });
    }

    if (body.action === "generate") {
      await insertAppLicense({
        appKey,
        notes: body.notes,
      });
      return Response.json({
        licenses: await listAppLicenses(appKey),
        events: await listAppLicenseEvents(appKey),
      });
    }

    if (body.action === "revoke") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await revokeAppLicense(body.licenseId.trim(), appKey);
      return Response.json({
        licenses: await listAppLicenses(appKey),
        events: await listAppLicenseEvents(appKey),
      });
    }

    if (body.action === "reset") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await resetAppLicense(body.licenseId.trim(), appKey);
      return Response.json({
        licenses: await listAppLicenses(appKey),
        events: await listAppLicenseEvents(appKey),
      });
    }

    return Response.json({ error: "Invalid app license action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "App license action failed." },
      { status: 500 },
    );
  }
}
