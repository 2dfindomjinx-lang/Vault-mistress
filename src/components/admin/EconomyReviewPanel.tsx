"use client";
import { useCallback, useEffect, useState } from "react";
type Failure = {
  id: string;
  user_id: string | null;
  operation_key: string;
  reason: string;
  error_code: string;
  created_at: string;
  resolved_at: string | null;
};
export function EconomyReviewPanel() {
  const [milestones, setMilestones] = useState<{
    firstVisits: number;
    firstGames: number;
    firstEquipment: number;
    nextDayEligible: number;
    nextDayReturns: number;
  } | null>(null);
  const [rows, setRows] = useState<Failure[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/economy", { cache: "no-store" });
      const p = await r.json();
      if (!r.ok) throw Error(p.error);
      setRows(p.failures);
      setMilestones(p.milestones);
      setCount(p.completedLast24h);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitoring unavailable.");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external monitoring fetch; state changes follow the network response
    void load();
  }, [load]);
  async function review(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reviewed", id }),
      });
      if (!r.ok) throw Error("Review could not be saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="court-panel m-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-100">
        Economy health ·{" "}
        {count === null ? "Loading…" : count + " completed actions in 24h"}
      </summary>
      {milestones && (
        <div className="mt-3 text-sm text-zinc-300">
          <p>
            Last 30 days, first observed visits: {milestones.firstVisits} ·
            First Court Game rewards: {milestones.firstGames} · First equipped
            looks: {milestones.firstEquipment}
          </p>
          <p className="mt-2">
            Next-day returns: {milestones.nextDayReturns} /{" "}
            {milestones.nextDayEligible} eligible accounts. Measured from
            deployment; existing players may enter this observed cohort.
          </p>
        </div>
      )}
      <p className="mt-3 text-sm text-zinc-400">
        Latest 100 failures from task claims, Court Games and profile actions. A
        successful retry closes its failure automatically. Review a reference
        against the ledger before marking it reviewed.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-rose-200">
          {error}
        </p>
      )}
      <button className="court-button mt-3" onClick={() => void load()}>
        Refresh
      </button>
      {!error && rows.length === 0 && (
        <p className="mt-3 text-sm">No failed actions recorded.</p>
      )}
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
          >
            <div className="min-w-0">
              <p className="text-zinc-100">
                {r.reason} · {r.error_code}
              </p>
              <p className="mt-1 break-all text-zinc-400">{r.operation_key}</p>
              <p className="mt-1 break-all text-zinc-400">
                User {r.user_id ?? "deleted"} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
            {r.resolved_at ? (
              <span className="text-emerald-200">Closed / reviewed</span>
            ) : (
              <button
                className="court-button"
                disabled={busy}
                onClick={() => void review(r.id)}
              >
                Mark reviewed
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
