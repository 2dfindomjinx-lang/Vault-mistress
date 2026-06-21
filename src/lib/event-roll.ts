import {
  EVENT_TEMPLATES,
  FIRST_DAY_EVENT_TEMPLATE,
  getEventCategory,
  getEventDayKey,
  isEventCompatibleWithActiveEvents,
  resolveEventEffect,
  type EventEffect,
  type EventTemplate,
} from "@/lib/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_MS } from "@/lib/time";

async function createAutomaticEvent(
  supabase: SupabaseClient,
  template: EventTemplate,
  automaticKey: string,
) {
  const now = new Date();
  const { data, error } = await supabase
    .from("random_events")
    .insert({
      active: true,
      automatic_key: automaticKey,
      description: template.description,
      effect: resolveEventEffect(template.effect),
      ends_at: new Date(now.getTime() + DAY_MS).toISOString(),
      name: template.name,
      starts_at: now.toISOString(),
    })
    .select("id, name, description, starts_at, ends_at, active, effect")
    .single();

  if (error) {
    console.error("Automatic event creation failed", error);
    throw error;
  }

  return data;
}

export async function rollRandomEvent(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const { error: expireError } = await supabase
    .from("random_events")
    .update({ active: false, updated_at: now })
    .eq("active", true)
    .lte("ends_at", now);

  if (expireError) {
    console.error("Expired event cleanup failed", expireError);
    return { error: "Event cleanup failed." as const, rolled: false };
  }

  const { data: activeEvents, error: activeError } = await supabase
    .from("random_events")
    .select("id, effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now);

  if (activeError) {
    console.error("Active event lookup failed", activeError);
    return { error: "Active event lookup failed." as const, rolled: false };
  }

  const currentActiveEvents = (activeEvents ?? []) as Array<{ id: string; effect: EventEffect }>;
  const automaticKey = `auto-${getEventDayKey()}`;
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
    return { error: "Daily event lookup failed." as const, rolled: false };
  }

  if (existingAutoEvent) {
    return { reason: "already_rolled" as const, rolled: false };
  }

  if ((totalEventCount ?? 0) === 0) {
    const event = isEventCompatibleWithActiveEvents(FIRST_DAY_EVENT_TEMPLATE.effect, currentActiveEvents)
      ? await createAutomaticEvent(supabase, FIRST_DAY_EVENT_TEMPLATE, automaticKey)
      : null;

    return { event, reason: "first_day" as const, rolled: Boolean(event) };
  }

  if (Math.random() > 0.2) {
    const now = new Date();
    const { error } = await supabase.from("random_events").insert({
      active: false,
      automatic_key: automaticKey,
      description: "No random event rolled for this day.",
      effect: { type: "task_reward_multiplier", multiplier: 1 },
      ends_at: new Date(now.getTime() + DAY_MS).toISOString(),
      name: "No Event",
      starts_at: now.toISOString(),
    });

    if (error) {
      console.error("No-event marker insert failed", error);
      return { error: "No-event marker failed." as const, rolled: false };
    }

    return { reason: "miss" as const, rolled: false };
  }

  const compatibleTemplates = EVENT_TEMPLATES.filter((template) =>
    isEventCompatibleWithActiveEvents(template.effect, currentActiveEvents),
  );
  const nonEconomyTemplates = compatibleTemplates.filter(
    (template) => getEventCategory(template.effect) !== "economy",
  );
  const templatePool = compatibleTemplates.length > 0 ? compatibleTemplates : nonEconomyTemplates;
  const template = templatePool[Math.floor(Math.random() * templatePool.length)];
  const event = template ? await createAutomaticEvent(supabase, template, automaticKey) : null;

  return {
    event,
    reason: event ? ("event" as const) : ("no_compatible_event" as const),
    rolled: Boolean(event),
  };
}
