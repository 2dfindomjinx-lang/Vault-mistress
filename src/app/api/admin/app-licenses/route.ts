import { requireAdminProfile } from "@/lib/admin-guard";
import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
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

// The activation log is paged (see APP_LICENSE_EVENTS_PAGE_SIZE); every
// response carries the requested page plus whether a next page exists.
async function eventsPayload(appKey: string, page = 0) {
  const { events, hasMore, page: resolvedPage } = await listAppLicenseEvents(appKey, page);
  return { events, eventsHasMore: hasMore, eventsPage: resolvedPage };
}

export async function GET(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const url = new URL(request.url);
  const appKey = requestedAppKey(url.searchParams.get("appKey"));
  if (!appKey) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }
  const eventsPage = Math.max(0, Number(url.searchParams.get("eventsPage")) || 0);
  // Paging through the log should not re-fetch the license list.
  const eventsOnly = url.searchParams.get("eventsOnly") === "1";

  try {
    if (eventsOnly) {
      return Response.json({ appKey, ...(await eventsPayload(appKey, eventsPage)) });
    }
    return Response.json({
      appKey,
      licenses: await listAppLicenses(appKey),
      ...(await eventsPayload(appKey, eventsPage)),
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
        ...(await eventsPayload(appKey)),
      });
    }

    if (body.action === "generate") {
      await insertAppLicense({
        appKey,
        notes: body.notes,
      });
      return Response.json({
        licenses: await listAppLicenses(appKey),
        ...(await eventsPayload(appKey)),
      });
    }

    if (body.action === "revoke") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await revokeAppLicense(body.licenseId.trim(), appKey);
      return Response.json({
        licenses: await listAppLicenses(appKey),
        ...(await eventsPayload(appKey)),
      });
    }

    if (body.action === "reset") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await resetAppLicense(body.licenseId.trim(), appKey);
      return Response.json({
        licenses: await listAppLicenses(appKey),
        ...(await eventsPayload(appKey)),
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
