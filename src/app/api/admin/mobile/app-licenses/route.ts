import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
  insertAppLicense,
  isSupportedAppLicenseKey,
  listAppLicenseEvents,
  listAppLicenses,
  resetAppLicense,
  revokeAppLicense,
} from "@/lib/app-licenses";
import { requireMobileAdmin } from "@/lib/mobile-admin";

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

// listAppLicenseEvents returns a paginated envelope. The mobile client wants the rows
// themselves under "events" -- spreading the envelope in here nested it one level deeper and
// broke every response, list and generate alike.
async function snapshot(appKey: string) {
  const eventPage = await listAppLicenseEvents(appKey);
  return {
    appKey,
    licenses: await listAppLicenses(appKey),
    events: eventPage.events,
    eventsHasMore: eventPage.hasMore,
  };
}

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const appKey = requestedAppKey(new URL(request.url).searchParams.get("appKey"));
  if (!appKey) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }

  try {
    return Response.json(await snapshot(appKey));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "App license list failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const appKey = requestedAppKey(body.appKey);
  if (!appKey) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }

  try {
    if (body.action === "generate") {
      await insertAppLicense({ appKey, notes: body.notes });
      return Response.json(await snapshot(appKey));
    }

    if (body.action === "revoke" || body.action === "reset") {
      const licenseId = body.licenseId?.trim();
      if (!licenseId) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      if (body.action === "revoke") {
        await revokeAppLicense(licenseId, appKey);
      } else {
        await resetAppLicense(licenseId, appKey);
      }
      return Response.json(await snapshot(appKey));
    }

    if (body.action === "list" || !body.action) {
      return Response.json(await snapshot(appKey));
    }

    return Response.json({ error: "Invalid app license action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "App license action failed." },
      { status: 500 },
    );
  }
}
