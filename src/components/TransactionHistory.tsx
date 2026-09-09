"use client";
import { useEffect, useState } from "react";
type Entry = {
  id: string;
  amount: number;
  balance_after: number | null;
  reason: string | null;
  created_at: string;
};
const labels: Record<string, string> = {
  "tribute:coin-offer": "Coin tribute",
  "convert:money-to-coins": "PM converted to Coin",
  "reward:daily-login": "Daily visit reward",
  "reward:task:daily-login": "Daily visit reward",
  "spend:gallery-unlock": "Gallery unlock",
  "spend:cosmetic": "Profile cosmetic",
  "spend:title": "Title purchase",
};
function label(reason: string | null) {
  return (
    labels[reason ?? ""] ??
    (reason ?? "Balance adjustment")
      .replace(/^(reward:game:|reward:task:)/, "Game reward: ")
      .replace(/[:-]/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
export function TransactionHistory({
  previewMode = false,
}: {
  previewMode?: boolean;
}) {
  const [currency, setCurrency] = useState("Coin");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (previewMode) return;
    const controller = new AbortController();
    fetch("/api/user/transactions?currency=" + currency, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (controller.signal.aborted) return;
        if (!r.ok) throw Error(p.error ?? "History unavailable.");
        setEntries(p.transactions);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "History unavailable.");
      });
    return () => controller.abort();
  }, [currency, previewMode, revision]);
  return (
    <section className="court-panel" aria-label="Transaction history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="court-eyebrow">Your account</p>
          <h2 className="text-xl font-semibold text-amber-50">
            Transaction history
          </h2>
        </div>
        <div className="flex gap-2">
          {["Coin", "PM"].map((c) => (
            <button
              className="court-button"
              aria-pressed={currency === c}
              type="button"
              key={c}
              onClick={() => {
                if (currency === c) return;
                setCurrency(c);
                setEntries(null);
                setError("");
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Your latest 50 entries. Coin is earned in the court; PM comes from
        verified payments. PM can become Coin.
      </p>
      {previewMode ? (
        <p className="mt-4 text-sm text-amber-100">
          Sign in to see your own purchases and rewards.
        </p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-rose-200">
          {error}{" "}
          <button
            className="court-button ml-2"
            onClick={() => setRevision((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      ) : entries === null ? (
        <p role="status" className="mt-4 text-sm">
          Loading history…
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-300">
          No {currency} transactions yet.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-white/10">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-3 text-sm">
              <div>
                <p className="capitalize text-zinc-100">{label(e.reason)}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  <time dateTime={e.created_at}>
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </p>
                <details className="mt-1 text-xs text-zinc-400">
                  <summary>Reference</summary>
                  <span className="break-all">{e.id}</span>
                </details>
              </div>
              <div className="text-right">
                <p
                  className={
                    e.amount > 0 ? "text-emerald-200" : "text-rose-200"
                  }
                >
                  {e.amount > 0 ? "+" : ""}
                  {e.amount.toLocaleString()} {currency}
                </p>
                {e.balance_after !== null && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Balance {e.balance_after.toLocaleString()}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
