import {
  type EventEffect,
  type RandomEvent,
} from "@/lib/events";
import {
  createPublicSupabaseClient,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";

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

export async function GET() {
  if (!isSupabasePublicConfigured) {
    return Response.json({ event: null });
  }

  const supabase = createPublicSupabaseClient();
  const now = new Date().toISOString();

  const { data: activeEvents, error: activeError } = await supabase
    .from("random_events")
    .select("id, name, description, starts_at, ends_at, active, effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false });

  if (activeError) {
    console.error("Active event lookup failed", activeError);
    return Response.json({ event: null });
  }

  const currentActiveEvents = (activeEvents ?? []).map((event) => toRandomEvent(event as EventRow));

  return Response.json(
    {
      event: currentActiveEvents[0] ?? null,
      events: currentActiveEvents,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    },
  );
}
