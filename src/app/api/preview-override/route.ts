export async function POST(request: Request) {
  const configuredPassword = process.env.PREVIEW_OVERRIDE_PASSWORD;
  const overrideEnabled = process.env.PREVIEW_OVERRIDE_ENABLED !== "false";

  if (!overrideEnabled || !configuredPassword) {
    return Response.json(
      { error: "Preview override is disabled." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  if (body?.password !== configuredPassword) {
    return Response.json({ error: "Invalid preview override password." }, { status: 401 });
  }

  return Response.json({ ok: true });
}
