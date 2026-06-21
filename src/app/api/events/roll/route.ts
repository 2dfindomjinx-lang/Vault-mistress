import { rollRandomEvent } from "@/lib/event-roll";
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

export async function POST(request: Request) {
  const admin = await authorizeRoll(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }
  const result = await rollRandomEvent(admin.supabase);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result);
}
