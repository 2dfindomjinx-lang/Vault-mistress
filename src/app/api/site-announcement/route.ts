import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SiteAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
};

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("site_announcements")
    .select("id, title, body, active, starts_at, ends_at")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Public site announcement lookup failed", error);
    return Response.json({ announcement: null }, { status: 200 });
  }

  return Response.json({ announcement: (data ?? null) as SiteAnnouncementRow | null });
}
