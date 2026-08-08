import { ImageResponse } from "next/og";
import { verifyCourtSealToken } from "@/lib/court-seal";

export const runtime = "nodejs";

export default async function OpenGraphImage({ params }: { params: Promise<{ token: string }> }) {
  const payload = verifyCourtSealToken((await params).token);
  if (!payload) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div style={{ background: "linear-gradient(135deg,#180711,#4a1238)", color: "#fff1fb", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: 72, width: "100%" }}>
      <div style={{ color: "#f9a8d4", fontSize: 28, letterSpacing: 8 }}>PRINCIPESSA&apos;S COURT</div>
      <div style={{ fontSize: 64, fontWeight: 800, marginTop: 28 }}>Court Seal</div>
      <div style={{ fontSize: 36, marginTop: 18 }}>{payload.rank ? `Devotion Rank #${payload.rank}` : "A sworn Court member"}</div>
      {payload.streak ? <div style={{ color: "#fbcfe8", fontSize: 26, marginTop: 16 }}>{payload.streak} day loyalty streak</div> : null}
    </div>,
    { width: 1200, height: 630 },
  );
}

