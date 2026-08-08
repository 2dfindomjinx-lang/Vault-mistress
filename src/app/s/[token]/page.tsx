import { verifyCourtSealToken } from "@/lib/court-seal";
import { notFound } from "next/navigation";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function CourtSealPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyCourtSealToken(token);
  if (!payload) notFound();
  return (
    <main className="min-h-screen bg-[#12050d] px-6 py-20 text-center text-pink-50">
      <p className="text-xs font-black uppercase tracking-[0.35em] text-pink-200/60">Principessa&apos;s Court</p>
      <h1 className="mt-5 text-4xl font-black">A Court Seal has been claimed.</h1>
      <p className="mx-auto mt-4 max-w-xl text-pink-100/70">
        {payload.rank ? `Devotion rank #${payload.rank}` : "A sworn Court member"}
        {payload.streak ? ` · ${payload.streak} day loyalty streak` : ""}
      </p>
      <a className="mt-8 inline-flex rounded-full border border-pink-300/40 bg-pink-500/20 px-5 py-3 font-black" href="/">
        Enter the Court
      </a>
    </main>
  );
}

