import Link from "next/link";
import { requireAdminProfile } from "@/lib/admin-guard";
import LockTransfersPanel from "@/components/LockTransfersPanel";

export const dynamic = "force-dynamic";

export default async function LockTransfersPage() {
  const admin = await requireAdminProfile();
  return (
    <main className="court-admin min-h-screen bg-[#08070b] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-[#0d0a12] p-5">
        <Link href="/admin" className="text-sm text-pink-200 hover:text-white">Back to Admin Console</Link>
        <h1 className="mt-4 text-3xl font-black">Principessa Lock Transfers</h1>
        {"error" in admin ? <p className="mt-4 text-rose-200">Admin access required.</p> : <LockTransfersPanel />}
      </section>
    </main>
  );
}
