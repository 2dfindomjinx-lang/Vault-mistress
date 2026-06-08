export async function GET() {
  return Response.json({
    wallpaperUrl: "https://vault-mistress.vercel.app/wallpapers/current.jpg",
    version: 1,
    updatedAt: "2026-06-08T00:00:00.000Z",
  });
}
