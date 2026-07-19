import {
  PRINCIPESSA_DISCIPLINE_APP_KEY,
  bindAppLicense,
  buildDeviceLabel,
  createSignedLicenseToken,
  findAppLicense,
  logAppLicenseEvent,
  normalizeLicenseCode,
  normalizeOwnerName,
  isSupportedAppLicenseKey,
  rebindAppLicenseForKnownDevice,
  touchAppLicenseValidation,
} from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActivationBody = {
  appKey?: string;
  activationCode?: string;
  installationId?: string;
  ownerName?: string;
  androidId?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
  appVersion?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ActivationBody;
  const appKey = body.appKey?.trim() || PRINCIPESSA_DISCIPLINE_APP_KEY;
  const activationCode = normalizeLicenseCode(body.activationCode ?? "");
  const installationId = body.installationId?.trim() ?? "";
  const ownerName = normalizeOwnerName(body.ownerName ?? "");
  const deviceLabel = buildDeviceLabel(body.deviceManufacturer, body.deviceModel);

  if (!isSupportedAppLicenseKey(appKey)) {
    return Response.json({ error: "Unknown app key." }, { status: 400 });
  }

  if (!activationCode || !installationId || !ownerName) {
    return Response.json({ error: "Activation code, installation id, and unique name are required." }, { status: 400 });
  }

  try {
    const license = await findAppLicense(appKey, activationCode);

    if (!license) {
      return Response.json({ error: "Activation code not found." }, { status: 404 });
    }

    if (license.status !== "active") {
      await logAppLicenseEvent({
        activationId: license.id,
        activationCodeSnapshot: license.activation_code,
        ownerNameSnapshot: ownerName,
        appKey,
        eventType: "rejected",
        installationId,
        deviceLabel,
        metadata: { reason: "revoked" },
      });
      return Response.json({ error: "This activation code has been revoked." }, { status: 403 });
    }

    if (!license.bound_installation_id) {
      await bindAppLicense({
        activationId: license.id,
        appKey,
        installationId,
        ownerName,
        androidId: body.androidId,
        deviceLabel,
      });

      const signedLicenseToken = createSignedLicenseToken({
        appKey,
        activationCode,
        installationId,
        ownerName,
        issuedAtMillis: Date.now(),
      });

      await logAppLicenseEvent({
        activationId: license.id,
        activationCodeSnapshot: license.activation_code,
        ownerNameSnapshot: ownerName,
        appKey,
        eventType: "activated",
        installationId,
        deviceLabel,
        metadata: { appVersion: body.appVersion ?? null },
      });

      return Response.json({ message: "Activation confirmed.", signedLicenseToken });
    }

    const sameOwner = (license.owner_name ?? "") === ownerName;
    const sameAndroidId =
      Boolean(body.androidId?.trim()) &&
      Boolean(license.bound_android_id?.trim()) &&
      license.bound_android_id?.trim() === body.androidId?.trim();

    if (sameOwner && sameAndroidId) {
      await rebindAppLicenseForKnownDevice({
        activationId: license.id,
        installationId,
        ownerName,
        androidId: body.androidId,
        deviceLabel,
      });

      const signedLicenseToken = createSignedLicenseToken({
        appKey,
        activationCode,
        installationId,
        ownerName,
        issuedAtMillis: Date.now(),
      });

      await logAppLicenseEvent({
        activationId: license.id,
        activationCodeSnapshot: license.activation_code,
        ownerNameSnapshot: ownerName,
        appKey,
        eventType: "reinstalled",
        installationId,
        deviceLabel,
        metadata: { appVersion: body.appVersion ?? null },
      });

      return Response.json({ message: "Same device recognized. Activation restored.", signedLicenseToken });
    }

    if (license.bound_installation_id !== installationId || !sameOwner) {
      await logAppLicenseEvent({
        activationId: license.id,
        activationCodeSnapshot: license.activation_code,
        ownerNameSnapshot: ownerName,
        appKey,
        eventType: "rejected",
        installationId,
        deviceLabel,
        metadata: { reason: "bound_elsewhere" },
      });
      return Response.json(
        { error: "This code is already bound to another device or unique name. Reset it from the admin panel first." },
        { status: 409 },
      );
    }

    await touchAppLicenseValidation({
      activationId: license.id,
      installationId,
      ownerName,
      androidId: body.androidId,
      deviceLabel,
    });

    const signedLicenseToken = createSignedLicenseToken({
      appKey,
      activationCode,
      installationId,
      ownerName,
      issuedAtMillis: Date.now(),
    });

    await logAppLicenseEvent({
      activationId: license.id,
      activationCodeSnapshot: license.activation_code,
      ownerNameSnapshot: ownerName,
      appKey,
      eventType: "validated",
      installationId,
      deviceLabel,
      metadata: { appVersion: body.appVersion ?? null },
    });

    return Response.json({ message: "Activation confirmed.", signedLicenseToken });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Activation failed." },
      { status: 500 },
    );
  }
}
