import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/admin-guard";

type TimeoutAction = "cancel" | "change";

function parseDuration(duration: string) {
  const match = duration.trim().toLowerCase().match(/^([1-9]\d*)(m|h|d)$/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60 * 1000 : unit === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return value * multiplier;
}

async function listTimeouts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, timeout_until, timeout_reason, shame_count")
    .gt("timeout_until", now)
    .order("timeout_until", { ascending: true });

  if (error) {
    console.error("Admin active timeout list failed", error);
    throw error;
  }

  return data ?? [];
}

export async function POST(request: Request) {
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin timeout route is not configured", configErrors);
    return Response.json(
      { error: `Admin environment is not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: TimeoutAction;
    userId?: string;
    duration?: string;
  };
  const supabase = admin.supabase;

  try {
    if (body.action === "cancel") {
      if (!body.userId) {
        return Response.json({ error: "Missing user id." }, { status: 400 });
      }

      const { error } = await supabase
        .from("profiles")
        .update({ timeout_reason: null, timeout_until: null, updated_at: new Date().toISOString() })
        .eq("id", body.userId);

      if (error) {
        console.error("Admin timeout cancel failed", error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({
        message: "Timeout cancelled.",
        users: await listTimeouts(supabase),
      });
    }

    if (body.action === "change") {
      if (!body.userId) {
        return Response.json({ error: "Missing user id." }, { status: 400 });
      }

      const durationMs = parseDuration(body.duration ?? "");

      if (!durationMs) {
        return Response.json(
          { error: "Invalid duration. Use examples like 1h, 6h, 1d, or 3d." },
          { status: 400 },
        );
      }

      const timeoutUntil = new Date(Date.now() + durationMs).toISOString();
      const { error } = await supabase
        .from("profiles")
        .update({ timeout_reason: null, timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
        .eq("id", body.userId);

      if (error) {
        console.error("Admin timeout duration update failed", error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({
        message: `Timeout changed to ${body.duration}.`,
        users: await listTimeouts(supabase),
      });
    }

    return Response.json({ users: await listTimeouts(supabase) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Timeout action failed." },
      { status: 500 },
    );
  }
}
