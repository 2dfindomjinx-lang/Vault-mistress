import Link from "next/link";
import { requireAdminProfile } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function PrincipessaLockAdminPage() {
  const admin = await requireAdminProfile();
  return (
    <main className="court-admin min-h-screen bg-[#08070b] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-[#0d0a12] p-5">
        <Link href="/admin" className="text-sm text-pink-200 hover:text-white">Back to Admin Console</Link>
        <h1 className="mt-4 text-3xl font-black">Principessa Lock</h1>
        {"error" in admin ? <p className="mt-4 text-rose-200">Admin access required.</p> : (
          <div className="mt-4">
            <p className="text-sm text-zinc-400">Review lifetime access transfers and Lock audit events without copying history into Vault.</p>
            <Link href="/admin/lock-transfers" className="mt-4 inline-flex rounded-md border border-pink-200/20 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-100 hover:bg-pink-500/20">Transfer History &amp; Approvals</Link>
          </div>
        )}
      </section>
    </main>
  );
}
