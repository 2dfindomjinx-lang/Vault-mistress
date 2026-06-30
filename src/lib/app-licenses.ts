import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSign, randomBytes } from "node:crypto";

export const PRINCIPESSA_DISCIPLINE_APP_KEY = "principessas-discipline";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_ACTIVATION_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCLaQTKq5VY+1d7
hNAhtCujPXXgGSX8sTmiH8c9TEwaP/AXYg6s52szwlnYCrt4NNJTb0Vt9bGtY/lJ
p8EaVYRIpy6hzNSf0dkuwciXl2XEzxSfFY0mwO6mfV7wXOvPKtcK/VmaaNaUgVea
ILCmCha10D8tHKc486IfOI4Fgf6jmoW1ZCm24DWE3HXeoNdULmg6LivUYRr6OXla
GqfXbACp2YW3UZaXhhF7OHCi8gsf+P8IeMw0GeGr1khYrOX+X5d9+JriV2g1tAD6
igXcOeC6jsQMFssecBOoexu21gnaE68d8RyNuAdbMcb33TXq82MnuSntFo8gwADU
I/PQBOXNAgMBAAECggEAAOPSYBSLUpeXlLrGPjaM3Z6wLSiwgpqDTgds5z6gp71i
mucJRaklYfkhkLFHIczz8wyLAWtVmIb5fleEckRf6eA+w1GCWIjVL9/dzt8RCyxe
YdS8vtyoSVjK0iSyR87GIV14zeMIcMc/c2l/S8Ewluxjd20KnReHV1dAcET9qzav
G9LWsAi5gEs+cP5FL9Y9kZix8qUucZwuLqrqFVaGIu0+KJIDOcofW4oxsWdjDN/t
NNcfAocGdy19n0tzwVoqf3xaMdBaXAegVDrCy/MeluyyksAVt2jFmhXanO5GCJXE
ZRpG4qG7gEXKn227wpq/zttwWnkElWTUPTYWQdlc4wKBgQDD3fWfNY3hYe1R+JKF
2Wsne2K/YbScQBb5iE8NlzFmyOBwBMf5Ff7+JnmqXyq7+DW2dsJgmRWr3kWdi4A5
MyiEmfbcyFNoOOAbXn6CaBdZ1RnUgqva2oG+4Dh5YM7bu57Eq3B0jUCf0FRNfjhN
OiJ7bU+MXKPadXh5to7L9BxH7wKBgQC2Nd/IV88B0n3sMz8eJOBgcjsdeigBD9u7
OYsnZ9m3Gy3VFGIj5jGJHPxCxhFsR6PwSi4ZH9MhRFj5WHinOz6CKq/8JzrsNzsX
ZOrY5+HbtRIcw12guD8CkRVn2tb93TDfxlFIpG6U3W0TrL1mtrX9msqbTUJ2AGOu
mm7MjDLSAwKBgEIJg9a556wlqC4K8NvQAiC9qP19o7dKpHRdUMn0P+O3tnQOKJ4C
nIZz0nFuxKm7deCfCcon0vavailD72dZqD+M6X5mzDhHdMfFhEHTdowDHUJZDDgt
k7EXR/MkgJn1GAKXCsNBHJjFVKcL90+SWi3jHP7l/RiaopPmyR5an25hAoGBAJxU
6tS0afqRQ9L1QRE26IA3YfrvhQUsOwWO4JKFqqlMm203WOCeLyAKC3GrCOXTLZgL
vTN3N6lSP9hnjNVGomICCA4bBpYG6R8wScKiaQkdeRXOlTVA/2bPXgNGIrGbJsTI
HZNq6Sm2NVDtI2/OEaUuOuk2R3CA8wWqoKfFHhFLAoGBAIEox7z2kIUhn1Wt0/FW
pdvUHmlTcyBzYUm1J2bgCSxFpAdq6Ktdcu3boHMq2DBCA7SqicyUvMNzg6w0PCUS
lyJS46/cWletvUtI9nDA3xhtBHMhI4ww+M2JuB4gwMdvV/ic+7q6/LUtEYe1aFZg
jS4sgeLjGEV4DlTjHj+AN0Aj
-----END PRIVATE KEY-----`;

export type AppLicenseRow = {
  id: string;
  app_key: string;
  activation_code: string;
  status: "active" | "revoked";
  owner_name: string | null;
  notes: string | null;
  bound_installation_id: string | null;
  bound_device_label: string | null;
  bound_android_id: string | null;
  bound_at: string | null;
  last_validated_at: string | null;
  reset_count: number;
  created_at: string;
  updated_at: string | null;
};

export type AppLicenseEventRow = {
  id: string;
  activation_id: string | null;
  activation_code_snapshot: string | null;
  owner_name_snapshot: string | null;
  event_type: string;
  installation_id: string | null;
  device_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SignedLicensePayload = {
  appKey: string;
  activationCode: string;
  installationId: string;
  ownerName: string;
  issuedAtMillis: number;
};

export function normalizeLicenseCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeOwnerName(name: string) {
  return name.trim();
}

export function buildDeviceLabel(manufacturer?: string | null, model?: string | null) {
  return [manufacturer?.trim(), model?.trim()].filter(Boolean).join(" ").trim() || null;
}

export async function listAppLicenses(appKey = PRINCIPESSA_DISCIPLINE_APP_KEY) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_activation_codes")
    .select("id, app_key, activation_code, status, owner_name, notes, bound_installation_id, bound_device_label, bound_android_id, bound_at, last_validated_at, reset_count, created_at, updated_at")
    .eq("app_key", appKey)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data ?? []) as AppLicenseRow[];
}

export async function listAppLicenseEvents(appKey = PRINCIPESSA_DISCIPLINE_APP_KEY) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_activation_events")
    .select("id, activation_id, activation_code_snapshot, owner_name_snapshot, event_type, installation_id, device_label, metadata, created_at")
    .eq("app_key", appKey)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as AppLicenseEventRow[];
}

export async function findAppLicense(appKey: string, activationCode: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_activation_codes")
    .select("id, app_key, activation_code, status, owner_name, notes, bound_installation_id, bound_device_label, bound_android_id, bound_at, last_validated_at, reset_count, created_at, updated_at")
    .eq("app_key", appKey)
    .eq("activation_code", normalizeLicenseCode(activationCode))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as AppLicenseRow | null;
}

export async function insertAppLicense(input: { appKey: string; notes?: string | null }) {
  const supabase = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const activationCode = generateActivationCode();
    const { data, error } = await supabase
      .from("app_activation_codes")
      .insert({
        app_key: input.appKey,
        activation_code: activationCode,
        notes: input.notes?.trim() || null,
        status: "active",
      })
      .select("id, app_key, activation_code, status, owner_name, notes, bound_installation_id, bound_device_label, bound_android_id, bound_at, last_validated_at, reset_count, created_at, updated_at")
      .single();

    if (!error && data) {
      await logAppLicenseEvent({
        activationId: data.id,
        activationCodeSnapshot: data.activation_code,
        appKey: data.app_key,
        eventType: "generated",
        metadata: { notes: data.notes },
      });
      return data as AppLicenseRow;
    }

    if (!String(error?.message ?? "").toLowerCase().includes("duplicate")) {
      throw error;
    }
  }

  throw new Error("Could not generate a unique activation code. Try again.");
}

export async function bindAppLicense(input: {
  activationId: string;
  installationId: string;
  ownerName: string;
  androidId?: string | null;
  deviceLabel?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const normalizedOwnerName = normalizeOwnerName(input.ownerName);
  const { data: collision, error: collisionError } = await supabase
    .from("app_activation_codes")
    .select("id")
    .eq("owner_name", normalizedOwnerName)
    .neq("id", input.activationId)
    .maybeSingle();

  if (collisionError) {
    throw collisionError;
  }
  if (collision) {
    throw new Error("That unique name is already in use.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_activation_codes")
    .update({
      owner_name: normalizedOwnerName,
      bound_installation_id: input.installationId,
      bound_android_id: input.androidId?.trim() || null,
      bound_device_label: input.deviceLabel?.trim() || null,
      bound_at: now,
      last_validated_at: now,
      updated_at: now,
    })
    .eq("id", input.activationId);

  if (error) {
    throw error;
  }
}

export async function rebindAppLicenseForKnownDevice(input: {
  activationId: string;
  installationId: string;
  ownerName: string;
  androidId?: string | null;
  deviceLabel?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const normalizedOwnerName = normalizeOwnerName(input.ownerName);
  const normalizedAndroidId = input.androidId?.trim() || null;

  if (!normalizedAndroidId) {
    throw new Error("Known-device reinstall requires a device id.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_activation_codes")
    .update({
      owner_name: normalizedOwnerName,
      bound_installation_id: input.installationId,
      bound_android_id: normalizedAndroidId,
      bound_device_label: input.deviceLabel?.trim() || null,
      bound_at: now,
      last_validated_at: now,
      updated_at: now,
    })
    .eq("id", input.activationId)
    .eq("owner_name", normalizedOwnerName)
    .eq("bound_android_id", normalizedAndroidId);

  if (error) {
    throw error;
  }
}

export async function touchAppLicenseValidation(input: {
  activationId: string;
  installationId: string;
  ownerName: string;
  androidId?: string | null;
  deviceLabel?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_activation_codes")
    .update({
      last_validated_at: now,
      bound_android_id: input.androidId?.trim() || null,
      bound_device_label: input.deviceLabel?.trim() || null,
      updated_at: now,
    })
    .eq("id", input.activationId)
    .eq("bound_installation_id", input.installationId)
    .eq("owner_name", normalizeOwnerName(input.ownerName));

  if (error) {
    throw error;
  }
}

export async function revokeAppLicense(licenseId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("app_activation_codes")
    .select("id, app_key, activation_code, status, owner_name, notes, bound_installation_id, bound_device_label, bound_android_id, bound_at, last_validated_at, reset_count, created_at, updated_at")
    .eq("id", licenseId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const hasBeenUsed =
    Boolean(existing.owner_name) ||
    Boolean(existing.bound_installation_id) ||
    Boolean(existing.bound_android_id) ||
    Boolean(existing.bound_at) ||
    Boolean(existing.last_validated_at) ||
    (existing.reset_count ?? 0) > 0;

  if (hasBeenUsed) {
    throw new Error("Used activation codes can no longer be revoked.");
  }

  const { error } = await supabase
    .from("app_activation_codes")
    .delete()
    .eq("id", licenseId);

  if (error) {
    throw error;
  }

  await logAppLicenseEvent({
    activationId: existing.id,
    activationCodeSnapshot: existing.activation_code,
    ownerNameSnapshot: existing.owner_name,
    appKey: existing.app_key,
    eventType: "deleted_unused",
  });

  return existing as AppLicenseRow;
}

export async function resetAppLicense(licenseId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("app_activation_codes")
    .select("id, app_key, activation_code, owner_name, reset_count")
    .eq("id", licenseId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_activation_codes")
    .update({
      status: "active",
      owner_name: null,
      bound_installation_id: null,
      bound_android_id: null,
      bound_device_label: null,
      bound_at: null,
      last_validated_at: null,
      reset_count: (existing.reset_count ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", licenseId)
    .select("id, app_key, activation_code, status, owner_name, notes, bound_installation_id, bound_device_label, bound_android_id, bound_at, last_validated_at, reset_count, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  await logAppLicenseEvent({
    activationId: data.id,
    activationCodeSnapshot: data.activation_code,
    ownerNameSnapshot: existing.owner_name,
    appKey: data.app_key,
    eventType: "reset",
    metadata: { resetCount: data.reset_count },
  });

  return data as AppLicenseRow;
}

export function createSignedLicenseToken(payload: SignedLicensePayload) {
  const privateKey = process.env.PRINCIPESSA_ACTIVATION_PRIVATE_KEY?.trim() || DEFAULT_ACTIVATION_PRIVATE_KEY;
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(payloadPart);
  signer.end();
  const signaturePart = signer.sign(privateKey, "base64url");
  return `${payloadPart}.${signaturePart}`;
}

export async function logAppLicenseEvent(input: {
  activationId?: string | null;
  appKey: string;
  activationCodeSnapshot?: string | null;
  ownerNameSnapshot?: string | null;
  eventType: string;
  installationId?: string | null;
  deviceLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("app_activation_events").insert({
    activation_id: input.activationId ?? null,
    app_key: input.appKey,
    activation_code_snapshot: input.activationCodeSnapshot ?? null,
    owner_name_snapshot: input.ownerNameSnapshot ?? null,
    event_type: input.eventType,
    installation_id: input.installationId ?? null,
    device_label: input.deviceLabel ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("App activation event log failed", error);
  }
}

function generateActivationCode() {
  const groups = [4, 4, 4, 4].map((length) => {
    const bytes = randomBytes(length);
    return Array.from(bytes, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
  });

  return groups.join("-");
}
