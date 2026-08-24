import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { resolveSealPayload } from "@/lib/court-seal";
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
  const payload = await resolveSealPayload((await params).token);
  if (!payload) return new Response("Not found", { status: 404 });

  const copy = COURT_SEAL_BOARD_COPY[payload.board];
  const metric = getCourtSealMetric(payload);
  const secondary = getCourtSealSecondary(payload);

  // Crate receipts get the item's own icon. Read from the public dir and
  // embedded as a data URI - the CSP-safe way to put a local file into satori.
  // Any failure just means a text-only card, never a broken image.
  let itemIcon: string | null = null;
  if (payload.board === "crate" && payload.itemId) {
    const imageUrl = SAMPLE_CRATE_ITEMS[payload.itemId]?.image_url;
    if (imageUrl && !imageUrl.includes("..")) {
      try {
        const file = await readFile(path.join(process.cwd(), "public", imageUrl));
        const mime = imageUrl.endsWith(".webp") ? "image/webp" : "image/png";
        itemIcon = `data:${mime};base64,${file.toString("base64")}`;
      } catch {
        itemIcon = null;
      }
    }
  }

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
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <div style={{ color: copy.accent, display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 7 }}>
            {copy.eyebrow}
          </div>
          {itemIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              height={150}
              src={itemIcon}
              style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.6))", objectFit: "contain" }}
              width={150}
            />
          ) : null}
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
