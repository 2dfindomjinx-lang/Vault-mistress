export async function POST(request: Request) {
  const body = (await request.json()) as {
    adminPassword?: string;
  };

  if (!process.env.ADMIN_PASSWORD) {
    console.error("Admin verify route is not configured: ADMIN_PASSWORD is missing");
    return Response.json(
      { error: "Admin environment is not configured: ADMIN_PASSWORD is missing" },
      { status: 500 },
    );
  }

  if (body.adminPassword !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Invalid admin password." }, { status: 401 });
  }

  return Response.json({ ok: true });
}
