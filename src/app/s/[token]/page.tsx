import type { Metadata } from "next";
import Link from "next/link";
import { verifyCourtSealToken } from "@/lib/court-seal";
import {
  COURT_SEAL_BOARD_COPY,
  getCourtSealMetric,
  getCourtSealSecondary,
} from "@/lib/court-seal-shared";
import { notFound } from "next/navigation";

type CourtSealPageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: CourtSealPageProps): Promise<Metadata> {
  const payload = verifyCourtSealToken((await params).token);
  if (!payload) return { robots: { follow: false, index: false }, title: "Invalid Court Seal" };
  const copy = COURT_SEAL_BOARD_COPY[payload.board];
  const description = `${getCourtSealMetric(payload)} · ${getCourtSealSecondary(payload)}`;
  return {
    description,
    openGraph: { description, title: copy.title, type: "website" },
    robots: { follow: false, index: false },
    title: copy.title,
    twitter: { card: "summary_large_image", description, title: copy.title },
  };
}

export default async function CourtSealPage({ params }: CourtSealPageProps) {
  const { token } = await params;
  const payload = verifyCourtSealToken(token);
  if (!payload) notFound();

  const copy = COURT_SEAL_BOARD_COPY[payload.board];
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#4a1238,#12050d_58%)] px-6 py-20 text-center text-pink-50">
      <section className="w-full max-w-2xl rounded-[2rem] border border-pink-200/20 bg-black/30 px-6 py-12 shadow-[0_0_70px_rgba(236,72,153,0.16)] sm:px-12">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-pink-200/60">{copy.eyebrow}</p>
        <h1 className="mt-5 text-4xl font-black sm:text-5xl">{copy.title}</h1>
        <p className="mt-5 text-xl font-bold text-pink-50">{getCourtSealMetric(payload)}</p>
        <p className="mt-2 text-sm text-pink-100/65">{getCourtSealSecondary(payload)}</p>
        <Link className="mt-8 inline-flex rounded-full border border-pink-300/40 bg-pink-500/20 px-5 py-3 font-black transition hover:bg-pink-500/30" href="/">
          Enter the Court
        </Link>
      </section>
    </main>
  );
}
