import { requireAdminProfile } from "@/lib/admin-guard";

type AdminAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string | null;
};

async function listAnnouncements(supabase: any) {
  const { data, error } = await supabase
    .from("site_announcements")
    .select("id, title, body, active, starts_at, ends_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Admin announcement list failed", error);
    throw error;
  }

  return (data ?? []) as AdminAnnouncementRow[];
}

export async function GET() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    return Response.json({ announcements: await listAnnouncements(admin.supabase) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Announcement list failed." },
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
    action?: "create" | "end" | "list";
    announcementId?: string;
    body?: string;
    days?: string | number;
    title?: string;
  };

  if (body.action === "list") {
    return Response.json({ announcements: await listAnnouncements(admin.supabase) });
  }

  if (body.action === "end") {
    const announcementId = body.announcementId?.trim();

    if (!announcementId) {
      return Response.json({ error: "Missing announcement id." }, { status: 400 });
    }

    const { error } = await admin.supabase
      .from("site_announcements")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", announcementId);

    if (error) {
      console.error("Admin announcement end failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ announcements: await listAnnouncements(admin.supabase) });
  }

  if (body.action === "create") {
    const title = body.title?.trim();
    const announcementBody = body.body?.trim();
    const durationDays = Number(body.days ?? 3);
    const safeDays = Number.isFinite(durationDays) ? Math.min(30, Math.max(1, Math.round(durationDays))) : 3;

    if (!title || !announcementBody) {
      return Response.json({ error: "title and body are required." }, { status: 400 });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);

    const { error: deactivateError } = await admin.supabase
      .from("site_announcements")
      .update({ active: false, updated_at: now.toISOString() })
      .eq("active", true);

    if (deactivateError) {
      console.error("Admin announcement deactivate failed", deactivateError);
      return Response.json({ error: deactivateError.message }, { status: 500 });
    }

    const { error } = await admin.supabase.from("site_announcements").insert({
      active: true,
      body: announcementBody,
      ends_at: endsAt.toISOString(),
      starts_at: now.toISOString(),
      title,
    });

    if (error) {
      console.error("Admin announcement create failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ announcements: await listAnnouncements(admin.supabase) });
  }

  return Response.json({ error: "Invalid announcement action." }, { status: 400 });
}
