import type { Metadata } from "next";
import { BirthdayStage } from "@/components/BirthdayStage";
import { BIRTHDAY_TARGET_CANDLES } from "@/lib/birthday";

// Standalone public page, deliberately NOT the dashboard shell that every
// other route in src/app renders (see src/app/tribute/page.tsx).
// /birthday-2026 remains online as a read-only memory after the event closes.
const TITLE = "Principessa's 22nd Birthday Court";
const DESCRIPTION = `Enter Principessa's 22nd Birthday Court: leave a wish, place a rose, and join her ${BIRTHDAY_TARGET_CANDLES}-candle celebration.`;

export const metadata: Metadata = {
  alternates: { canonical: "/birthday-2026" },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    images: [
      {
        alt: "Principessa's 22nd Birthday — August 14 — Light Her Cake",
        height: 630,
        url: "/birthday/principessa-birthday-og-2026.png?v=20260812-celebration",
        width: 1200,
      },
    ],
    title: TITLE,
    type: "website",
    // X can retain the very first card it saw for a URL. The social identity
    // uses a versioned query while the canonical remains the clean route.
    url: "/birthday-2026?court=2026-celebration",
  },
  title: TITLE,
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    images: ["/birthday/principessa-birthday-og-2026.png?v=20260812-celebration"],
    title: TITLE,
  },
};

export default function Birthday2026Page() {
  return <BirthdayStage />;
}
