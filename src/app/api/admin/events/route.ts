import { requireAdminProfile } from "@/lib/admin-guard";
import { getEventTemplate, getUtcDayBounds, resolveEventEffect, type EventEffect } from "@/lib/events";

type AdminEventBody = {
  action?: "activate" | "create" | "end";
  description?: string;
  effect?: EventEffect;
  endsAt?: string;
  eventId?: string;
  name?: string;
  startsAt?: string;
  templateKey?: string;
};

const EVENT_LOG_RETENTION_DAYS = 7;

function getEventLogCutoffIso() {
  return new Date(Date.now() - EVENT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupOldEventLogs(admin: Awaited<ReturnType<typeof requireAdminProfile>>) {
  if ("error" in admin) {
    return;
  }

  const { error } = await admin.supabase
    .from("random_events")
    .delete()
    .eq("active", false)
    .lt("created_at", getEventLogCutoffIso());

  if (error) {
    console.error("Admin event log cleanup failed", error);
  }
}

export async function GET() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  await cleanupOldEventLogs(admin);

  const { data, error } = await admin.supabase
    .from("random_events")
    .select("id, name, description, starts_at, ends_at, active, effect, created_at")
    .gte("created_at", getEventLogCutoffIso())
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Admin event list failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  await cleanupOldEventLogs(admin);

  const body = (await request.json()) as AdminEventBody;
  const now = new Date().toISOString();

  if (body.action === "end") {
    if (!body.eventId) {
      return Response.json({ error: "eventId is required." }, { status: 400 });
    }

    const { error } = await admin.supabase
      .from("random_events")
      .update({ active: false, updated_at: now })
      .eq("id", body.eventId);

    if (error) {
      console.error("Admin event end failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  if (body.action === "activate") {
    if (!body.eventId) {
      return Response.json({ error: "eventId is required." }, { status: 400 });
    }

    await admin.supabase
      .from("random_events")
      .update({ active: false, updated_at: now })
      .eq("active", true);

    const { data, error } = await admin.supabase
      .from("random_events")
      .update({ active: true, updated_at: now })
      .eq("id", body.eventId)
      .select("id, name, description, starts_at, ends_at, active, effect")
      .single();

    if (error) {
      console.error("Admin event activate failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ event: data });
  }

  if (body.action === "create") {
    const template = body.templateKey ? getEventTemplate(body.templateKey) : null;
    const { end, start } = getUtcDayBounds();
    const name = body.name ?? template?.name;
    const description = body.description ?? template?.description;
    const effect = body.effect ?? template?.effect;

    if (!name || !description || !effect) {
      return Response.json(
        { error: "name, description, and effect are required." },
        { status: 400 },
      );
    }

    await admin.supabase
      .from("random_events")
      .update({ active: false, updated_at: now })
      .eq("active", true);

    const { data, error } = await admin.supabase
      .from("random_events")
      .insert({
        active: true,
        description,
        effect: resolveEventEffect(effect),
        ends_at: body.endsAt ?? end.toISOString(),
        name,
        starts_at: body.startsAt ?? start.toISOString(),
      })
      .select("id, name, description, starts_at, ends_at, active, effect")
      .single();

    if (error) {
      console.error("Admin event create failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ event: data });
  }

  return Response.json({ error: "Invalid event action." }, { status: 400 });
}
