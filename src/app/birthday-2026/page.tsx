import type { Metadata } from "next";
import { BirthdayStage } from "@/components/BirthdayStage";
import { BIRTHDAY_TARGET_CANDLES } from "@/lib/birthday";

// Standalone public page, deliberately NOT the dashboard shell that every
// other route in src/app renders (see src/app/tribute/page.tsx).
// /birthday-2026 remains online as a read-only memory after the event closes.
const TITLE = "Principessa's 22nd Birthday Court";
const DESCRIPTION = `Remember Principessa's 22nd Birthday Court: ${BIRTHDAY_TARGET_CANDLES} candles, her private wishlist, and the names that lit the night.`;

export const metadata: Metadata = {
  alternates: { canonical: "/birthday-2026" },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    images: [
      {
        alt: "Principessa's 22nd Birthday — August 14 — Light Her Cake",
        height: 630,
        url: "/birthday/principessa-birthday-og-2026.png",
        width: 1200,
      },
    ],
    title: TITLE,
    type: "website",
    url: "/birthday-2026",
  },
  title: TITLE,
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    images: ["/birthday/principessa-birthday-og-2026.png"],
    title: TITLE,
  },
};

export default function Birthday2026Page() {
  return <BirthdayStage />;
}
