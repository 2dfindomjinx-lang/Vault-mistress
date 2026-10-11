"use client";

import styles from "./CollectionSurfaces.module.css";
import { useEffect, useId, useState } from "react";
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
const PAGE_SIZE = 6;
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
  userId,
}: {
  previewMode?: boolean;
  userId?: string;
}) {
  const panelId = useId();
  const preferenceKey = `vault:transaction-history:${userId ?? "guest"}:collapsed`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a preference from browser storage after hydration/account changes
      setCollapsed(localStorage.getItem(preferenceKey) === "true");
    } catch { /* Storage can be disabled; the panel still works for this visit. */ }
  }, [preferenceKey]);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(preferenceKey, String(next)); } catch { /* Optional persistence. */ }
  };
  const [currency, setCurrency] = useState("Coin");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil((entries?.length ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
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
    <section className={`${styles.surface} ${styles.ledger}`} data-collection-surface="ledger" data-collapsed={collapsed} aria-label="Transaction history">
      <div className={styles.header}>
        <div>
          <p className="court-eyebrow">Your account</p>
          <h2 className="text-xl font-semibold text-amber-50">
            <button type="button" className={styles.ledgerToggle} aria-expanded={!collapsed} aria-controls={panelId} onClick={toggle}>
              Transaction history
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={collapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"}/></svg>
            </button>
          </h2>
        </div>
        <div className={styles.currencyTabs}>
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
                setPage(0);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div id={panelId} hidden={collapsed}>
      <p className="mt-2 text-sm text-zinc-400">
        Every purchase. Every reward. Your account, recorded.
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
        <>
          <ol className={`${styles.ledgerList} divide-y divide-white/10`}>
            {entries
              .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
              .map((e) => (
                <li
                  key={e.id}
                  className={`${styles.ledgerRow} flex justify-between gap-3 text-sm`}
                >
                  <div>
                    <p className="capitalize text-zinc-100">
                      {label(e.reason)}
                    </p>
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
                      className={`${styles.ledgerAmount} ${e.amount > 0 ? "text-emerald-200" : "text-rose-200"}`}
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
          {pageCount > 1 && (
            <nav
              className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3"
              aria-label="Transaction pages"
            >
              <button
                type="button"
                className="court-button disabled:opacity-35"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Newer
              </button>
              <span className="text-xs text-zinc-400" aria-live="polite">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="court-button disabled:opacity-35"
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Older
              </button>
            </nav>
          )}
        </>
      )}
      </div>
    </section>
  );
}
