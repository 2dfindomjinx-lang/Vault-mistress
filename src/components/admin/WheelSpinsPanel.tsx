"use client";

import { useCallback, useEffect, useState } from "react";

// Admin ledger for the findom wheels: who spun, what the pointer demanded, and
// whether she has been paid. Self-contained (fetches on mount) so the admin
// page's tab machinery does not need to know it exists.

type AdminWheelSpin = {
  amount: number;
  amountOwedUsd: number;
  amountPaidUsd: number;
  createdAt: string;
  id: string;
  kind: string;
  paidAt: string | null;
  paidVia: string | null;
  payCode: string | null;
  segmentLabel: string;
  status: string;
  user: string;
  wheelId: string;
};

const STATUS_STYLE: Record<string, string> = {
  paid: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  settled: "border-violet-300/25 bg-violet-500/10 text-violet-100",
  unpaid: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  waived: "border-zinc-400/25 bg-zinc-500/10 text-zinc-300",
};

export function WheelSpinsPanel() {
  const [spins, setSpins] = useState<AdminWheelSpin[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [waivingId, setWaivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/wheel-spins", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; spins?: AdminWheelSpin[] }
        | null;
      if (!response.ok || !payload?.spins) {
        throw new Error(payload?.error ?? "Wheel spins could not be loaded.");
      }
      setSpins(payload.spins);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wheel spins could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount against an external system
    void load();
  }, [load]);

  const waive = async (spinId: string) => {
    if (!window.confirm("Waive this debt? The spin unblocks without payment.")) return;
    setWaivingId(spinId);
    try {
      const response = await fetch("/api/admin/wheel-spins", {
        body: JSON.stringify({ action: "waive", spinId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; waived?: boolean } | null;
      if (!response.ok || !payload?.waived) {
        throw new Error(payload?.error ?? "The debt could not be waived.");
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The debt could not be waived.");
    } finally {
      setWaivingId(null);
    }
  };

  const unpaidCount = spins.filter((spin) => spin.status === "unpaid").length;

  return (
    <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#080304] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-pink-200/80">Wheel Spins</p>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Every spin, its verdict and its payment state. Throne payments carrying the WL- code land here
            automatically; PM payments settle instantly. Waive only when you mean to forgive the debt.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-black leading-none text-pink-100">{unpaidCount}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-pink-200/50">Unpaid</p>
          </div>
          <button
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2">
        {spins.length === 0 && !loading ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-zinc-500">
            Nobody has spun yet.
          </p>
        ) : null}
        {spins.map((spin) => (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5"
            key={spin.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-pink-50">{spin.user}</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {new Date(spin.createdAt).toLocaleString()} · {spin.wheelId}
                {spin.payCode ? ` · ${spin.payCode}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-[#ffe2ad]">
                {spin.kind === "chastity" ? `+${spin.amount} days` : `${spin.segmentLabel} · $${spin.amountOwedUsd.toLocaleString()}`}
              </p>
              {spin.kind === "money" && spin.status === "unpaid" && spin.amountPaidUsd > 0 ? (
                <p className="text-[10px] text-zinc-500">${spin.amountPaidUsd.toLocaleString()} received</p>
              ) : null}
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${STATUS_STYLE[spin.status] ?? STATUS_STYLE.waived}`}
            >
              {spin.status}
              {spin.paidVia ? ` · ${spin.paidVia}` : ""}
            </span>
            {spin.status === "unpaid" ? (
              <button
                className="rounded-xl border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-300 transition hover:border-rose-300/40 hover:text-rose-100 disabled:opacity-40"
                disabled={waivingId === spin.id}
                onClick={() => void waive(spin.id)}
                type="button"
              >
                {waivingId === spin.id ? "Waiving" : "Waive"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
