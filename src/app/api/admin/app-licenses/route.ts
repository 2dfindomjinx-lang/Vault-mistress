import { requireAdminProfile } from "@/lib/admin-guard";
import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
  insertAppLicense,
  listAppLicenseEvents,
  listAppLicenses,
  resetAppLicense,
  revokeAppLicense,
} from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    return Response.json({
      licenses: await listAppLicenses(PRINCIPESSA_DISCIPLINE_APP_KEY),
      events: await listAppLicenseEvents(PRINCIPESSA_DISCIPLINE_APP_KEY),
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

  const body = (await request.json()) as {
    action?: "generate" | "revoke" | "reset" | "list";
    licenseId?: string;
    notes?: string;
  };

  try {
    if (body.action === "list") {
      return Response.json({
        licenses: await listAppLicenses(PRINCIPESSA_DISCIPLINE_APP_KEY),
        events: await listAppLicenseEvents(PRINCIPESSA_DISCIPLINE_APP_KEY),
      });
    }

    if (body.action === "generate") {
      await insertAppLicense({
        appKey: PRINCIPESSA_DISCIPLINE_APP_KEY,
        notes: body.notes,
      });
      return Response.json({
        licenses: await listAppLicenses(PRINCIPESSA_DISCIPLINE_APP_KEY),
        events: await listAppLicenseEvents(PRINCIPESSA_DISCIPLINE_APP_KEY),
      });
    }

    if (body.action === "revoke") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await revokeAppLicense(body.licenseId.trim());
      return Response.json({
        licenses: await listAppLicenses(PRINCIPESSA_DISCIPLINE_APP_KEY),
        events: await listAppLicenseEvents(PRINCIPESSA_DISCIPLINE_APP_KEY),
      });
    }

    if (body.action === "reset") {
      if (!body.licenseId?.trim()) {
        return Response.json({ error: "Missing license id." }, { status: 400 });
      }
      await resetAppLicense(body.licenseId.trim());
      return Response.json({
        licenses: await listAppLicenses(PRINCIPESSA_DISCIPLINE_APP_KEY),
        events: await listAppLicenseEvents(PRINCIPESSA_DISCIPLINE_APP_KEY),
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
