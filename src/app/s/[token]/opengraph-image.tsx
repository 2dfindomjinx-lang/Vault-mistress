import { ImageResponse } from "next/og";
import { verifyCourtSealToken } from "@/lib/court-seal";
import {
  COURT_SEAL_BOARD_COPY,
  getCourtSealMetric,
  getCourtSealSecondary,
} from "@/lib/court-seal-shared";

export const runtime = "nodejs";
export const alt = "A signed achievement from Principessa's Court";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ token: string }> }) {
  const payload = verifyCourtSealToken((await params).token);
  if (!payload) return new Response("Not found", { status: 404 });

  const copy = COURT_SEAL_BOARD_COPY[payload.board];
  const metric = getCourtSealMetric(payload);
  const secondary = getCourtSealSecondary(payload);

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "radial-gradient(circle at 82% 18%, #6d194f 0%, #2b0b22 32%, #090309 72%)",
        color: "#fff7fb",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        padding: 54,
        position: "relative",
        width: "100%",
      }}
    >
      <div style={{ border: "2px solid rgba(244, 114, 182, 0.2)", inset: 24, position: "absolute" }} />
      <div style={{ border: "1px solid rgba(252, 211, 77, 0.24)", inset: 38, position: "absolute" }} />
      <div
        style={{
          background: "rgba(0,0,0,0.32)",
          border: `1px solid ${copy.accent}55`,
          borderRadius: 34,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "62px 72px",
          width: "100%",
        }}
      >
        <div style={{ color: copy.accent, display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 7 }}>
          {copy.eyebrow}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, marginTop: 30 }}>
          {copy.title}
        </div>
        <div style={{ color: "#fff1f7", display: "flex", fontSize: 44, fontWeight: 700, marginTop: 24 }}>
          {metric}
        </div>
        <div style={{ color: "rgba(255,235,246,0.68)", display: "flex", fontSize: 25, marginTop: 18 }}>
          {secondary}
        </div>
        <div style={{ alignItems: "center", display: "flex", marginTop: 42 }}>
          <div style={{ background: copy.accent, display: "flex", height: 2, width: 92 }} />
          <div style={{ background: "#f6d58b", borderRadius: 999, display: "flex", height: 10, margin: "0 18px", width: 10 }} />
          <div style={{ color: "rgba(255,235,246,0.54)", display: "flex", fontSize: 20, letterSpacing: 4 }}>
            VAULT MISTRESS
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
