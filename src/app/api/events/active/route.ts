import {
  EVENT_TEMPLATES,
  FIRST_DAY_EVENT_TEMPLATE,
  getEventDayKey,
  getUtcDayBounds,
  type EventEffect,
  type EventTemplate,
  type RandomEvent,
} from "@/lib/events";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type EventRow = {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  effect: EventEffect;
};

function toRandomEvent(row: EventRow): RandomEvent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    active: row.active,
    effect: row.effect,
  };
}

async function createAutomaticEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  template: EventTemplate,
  automaticKey: string,
) {
  const { end, start } = getUtcDayBounds();
  const { data, error } = await supabase
    .from("random_events")
    .insert({
      active: true,
      automatic_key: automaticKey,
      description: template.description,
      effect: template.effect,
      ends_at: end.toISOString(),
      name: template.name,
      starts_at: start.toISOString(),
    })
    .select("id, name, description, starts_at, ends_at, active, effect")
    .single();

  if (error) {
    console.error("Automatic event creation failed", error);
    return null;
  }

  return toRandomEvent(data as EventRow);
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ event: null });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: expireError } = await supabase
    .from("random_events")
    .update({ active: false, updated_at: now })
    .eq("active", true)
    .lte("ends_at", now);

  if (expireError) {
    console.error("Expired event cleanup failed", expireError);
  }

  const { data: activeEvents, error: activeError } = await supabase
    .from("random_events")
    .select("id, name, description, starts_at, ends_at, active, effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (activeError) {
    console.error("Active event lookup failed", activeError);
    return Response.json({ event: null });
  }

  if (activeEvents && activeEvents.length > 0) {
    return Response.json({ event: toRandomEvent(activeEvents[0] as EventRow) });
  }

  const dayKey = getEventDayKey();
  const automaticKey = `auto-${dayKey}`;
  const { count: totalEventCount } = await supabase
    .from("random_events")
    .select("id", { count: "exact", head: true });
  const { data: existingAutoEvent, error: existingError } = await supabase
    .from("random_events")
    .select("id")
    .eq("automatic_key", automaticKey)
    .maybeSingle();

  if (existingError) {
    console.error("Daily automatic event lookup failed", existingError);
    return Response.json({ event: null });
  }

  if (existingAutoEvent) {
    return Response.json({ event: null });
  }

  if ((totalEventCount ?? 0) === 0) {
    const event = await createAutomaticEvent(
      supabase,
      FIRST_DAY_EVENT_TEMPLATE,
      automaticKey,
    );

    return Response.json({ event });
  }

  if (Math.random() > 0.15) {
    const { error } = await supabase.from("random_events").insert({
      active: false,
      automatic_key: automaticKey,
      description: "No random event rolled for this day.",
      effect: { type: "task_reward_multiplier", multiplier: 1 },
      ends_at: getUtcDayBounds().end.toISOString(),
      name: "No Event",
      starts_at: getUtcDayBounds().start.toISOString(),
    });

    if (error) {
      console.error("No-event marker insert failed", error);
    }

    return Response.json({ event: null });
  }

  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const event = await createAutomaticEvent(supabase, template, automaticKey);

  return Response.json({ event });
}
