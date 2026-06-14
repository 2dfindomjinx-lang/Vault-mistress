import {
  EVENT_TEMPLATES,
  FIRST_DAY_EVENT_TEMPLATE,
  getEventCategory,
  getEventDayKey,
  getUtcDayBounds,
  isEventCompatibleWithActiveEvents,
  resolveEventEffect,
  type EventEffect,
  type EventTemplate,
} from "@/lib/events";
import { requireAdmin } from "@/lib/admin-guard";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;

async function authorizeRoll(request: Request): Promise<AdminContext> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (cronSecret && token === cronSecret) {
    if (!isSupabaseAdminConfigured) {
      return {
        error: `Admin Supabase environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
        status: 500,
      } as const;
    }

    return {
      adminProfile: null,
      adminUser: { id: "cron" },
      supabase: createSupabaseAdminClient(),
    } as unknown as AdminContext;
  }

  return requireAdmin();
}

async function createAutomaticEvent(
  admin: Exclude<AdminContext, { error: string }>,
  template: EventTemplate,
  automaticKey: string,
) {
  const { end, start } = getUtcDayBounds();
  const { data, error } = await admin.supabase
    .from("random_events")
    .insert({
      active: true,
      automatic_key: automaticKey,
      description: template.description,
      effect: resolveEventEffect(template.effect),
      ends_at: end.toISOString(),
      name: template.name,
      starts_at: start.toISOString(),
    })
    .select("id, name, description, starts_at, ends_at, active, effect")
    .single();

  if (error) {
    console.error("Protected automatic event creation failed", error);
    throw error;
  }

  return data;
}

export async function POST(request: Request) {
  const admin = await authorizeRoll(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const now = new Date().toISOString();
  const { error: expireError } = await admin.supabase
    .from("random_events")
    .update({ active: false, updated_at: now })
    .eq("active", true)
    .lte("ends_at", now);

  if (expireError) {
    console.error("Protected expired event cleanup failed", expireError);
    return Response.json({ error: "Event cleanup failed." }, { status: 500 });
  }

  const { data: activeEvents, error: activeError } = await admin.supabase
    .from("random_events")
    .select("id, effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now);

  if (activeError) {
    console.error("Protected active event lookup failed", activeError);
    return Response.json({ error: "Active event lookup failed." }, { status: 500 });
  }

  const currentActiveEvents = (activeEvents ?? []) as Array<{ id: string; effect: EventEffect }>;
  const automaticKey = `auto-${getEventDayKey()}`;
  const { count: totalEventCount } = await admin.supabase
    .from("random_events")
    .select("id", { count: "exact", head: true });
  const { data: existingAutoEvent, error: existingError } = await admin.supabase
    .from("random_events")
    .select("id")
    .eq("automatic_key", automaticKey)
    .maybeSingle();

  if (existingError) {
    console.error("Protected daily automatic event lookup failed", existingError);
    return Response.json({ error: "Daily event lookup failed." }, { status: 500 });
  }

  if (existingAutoEvent) {
    return Response.json({ event: null, rolled: false, reason: "already_rolled" });
  }

  if ((totalEventCount ?? 0) === 0) {
    const event = isEventCompatibleWithActiveEvents(FIRST_DAY_EVENT_TEMPLATE.effect, currentActiveEvents)
      ? await createAutomaticEvent(admin, FIRST_DAY_EVENT_TEMPLATE, automaticKey)
      : null;

    return Response.json({ event, rolled: Boolean(event), reason: "first_day" });
  }

  if (Math.random() > 0.2) {
    const { error } = await admin.supabase.from("random_events").insert({
      active: false,
      automatic_key: automaticKey,
      description: "No random event rolled for this day.",
      effect: { type: "task_reward_multiplier", multiplier: 1 },
      ends_at: getUtcDayBounds().end.toISOString(),
      name: "No Event",
      starts_at: getUtcDayBounds().start.toISOString(),
    });

    if (error) {
      console.error("Protected no-event marker insert failed", error);
      return Response.json({ error: "No-event marker failed." }, { status: 500 });
    }

    return Response.json({ event: null, rolled: false, reason: "miss" });
  }

  const compatibleTemplates = EVENT_TEMPLATES.filter((template) =>
    isEventCompatibleWithActiveEvents(template.effect, currentActiveEvents),
  );
  const nonEconomyTemplates = compatibleTemplates.filter(
    (template) => getEventCategory(template.effect) !== "economy",
  );
  const templatePool = compatibleTemplates.length > 0 ? compatibleTemplates : nonEconomyTemplates;
  const template = templatePool[Math.floor(Math.random() * templatePool.length)];
  const event = template ? await createAutomaticEvent(admin, template, automaticKey) : null;

  return Response.json({ event, rolled: Boolean(event), reason: event ? "event" : "no_compatible_event" });
}
