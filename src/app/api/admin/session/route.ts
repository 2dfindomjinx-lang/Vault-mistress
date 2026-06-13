import { requireAdminProfile } from "@/lib/admin-guard";

export async function GET() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ isAdmin: false, error: admin.error }, { status: admin.status });
  }

  return Response.json({
    isAdmin: true,
    userId: admin.adminUser.id,
    username: admin.adminProfile?.username ?? null,
  });
}
