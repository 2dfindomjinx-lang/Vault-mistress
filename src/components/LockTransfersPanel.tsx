"use client";

import { useEffect, useRef, useState } from "react";
import type { LockTransfer, LockTransferHistory } from "@/lib/lock-transfer-types";

const endpoint = "/api/admin/lock-transfers";
const buttonClass = "rounded-md border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-sm font-bold text-pink-100 hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40";
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";

async function request(body?: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(endpoint, {
    cache: "no-store", credentials: "same-origin", signal,
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(result.error ?? "Lock request failed.");
  return result;
}

export default function LockTransfersPanel() {
  const [history, setHistory] = useState<LockTransferHistory | null>(null);
  const [sourceDeviceId, setSourceDeviceId] = useState("");
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [fresh, setFresh] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setHistory(result); setFresh(true); }
    }).catch((error) => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Lock history failed.");
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!issued) return;
    const timeout = window.setTimeout(() => setIssued(null), Math.max(0, Math.min(300_000, new Date(issued.expiresAt).getTime() - Date.now())));
    return () => window.clearTimeout(timeout);
  }, [issued]);

  const reload = async () => {
    const result = await request();
    setHistory(result);
    setFresh(true);
  };

  const refresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage(""); setFresh(false);
    try { await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Lock history failed."); }
    finally { setBusy(false); inFlight.current = false; }
  };

  const mutate = async (body: Record<string, string>, confirmation: string) => {
    if (inFlight.current || !window.confirm(confirmation)) return;
    inFlight.current = true;
    setBusy(true); setMessage(""); setFresh(false); setIssued(null);
    try {
      const result = await request(body);
      if (body.action === "issue") setIssued({ code: result.code, expiresAt: result.expiresAt });
      setMessage(body.action === "issue" ? "Code created. Share it privately with the intended recipient." : "Decision saved by Lock.");
      try { await reload(); }
      catch { setMessage("Action succeeded, but history could not refresh. Refresh before taking another action."); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed. Refresh before retrying.");
    } finally { setBusy(false); inFlight.current = false; }
  };

  const decide = (transfer: LockTransfer, action: "approve" | "reject") => {
    const from = `${transfer.source_username ?? transfer.source_sub_id} / ${transfer.source_device_name ?? transfer.source_device_id}`;
    const to = `${transfer.target_username ?? transfer.target_sub_id} / ${transfer.target_device_name ?? transfer.target_device_id}`;
    void mutate({ action, transferId: transfer.id }, `${action === "approve" ? "Approve" : "Reject"} lifetime access transfer?\nFrom: ${from}\nTo: ${to}\nTransfer: ${transfer.id}${action === "approve" ? "\nThis moves the lifetime access away from the source device." : ""}`);
  };

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-zinc-400">Live Lock history, newest first: up to 100 transfers and 200 audit events. No history is copied into Vault. Lock checks eligibility again when issuing and approving.</p>
        <button className={buttonClass} disabled={busy} onClick={() => void refresh()}>{busy ? "Loading..." : "Refresh"}</button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-amber-200">{message}</p>
      {history && !fresh && !busy && <p className="text-sm text-rose-200">History may be stale. Refresh to enable actions.</p>}
      <section className="rounded-lg border border-white/10 p-4">
        <h2 className="text-lg font-bold">Issue transfer code</h2>
        <label htmlFor="lock-source" className="mt-3 block text-sm text-zinc-300">Approved source device</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select id="lock-source" value={sourceDeviceId} disabled={busy || !fresh} onChange={(event) => setSourceDeviceId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-white/20 bg-[#17111d] p-2 text-sm">
            <option value="">Select a source device</option>
            {history?.eligibleSources.map((source) => <option key={source.id} value={source.id}>{source.username ?? source.sub_id} / {source.device_name ?? "Unnamed device"} / {source.id}</option>)}
          </select>
          <button className={buttonClass} disabled={busy || !fresh || !history?.eligibleSources.some((source) => source.id === sourceDeviceId)} onClick={() => void mutate({ action: "issue", sourceDeviceId }, "Create a private lifetime access transfer code for this source device? The recipient will still need admin approval.")}>Create Code</button>
        </div>
        {fresh && history?.eligibleSources.length === 0 && <p className="mt-2 text-sm text-zinc-400">No eligible source devices.</p>}
        {issued && <div className="mt-4 rounded-md border border-amber-200/30 p-3">
          <p className="text-sm text-amber-100">Private code, not included in history. This view clears after five minutes or expiry.</p>
          <p className="my-3 break-all font-mono text-2xl tracking-widest">{issued.code}</p>
          <p className="text-xs text-zinc-400">Expires: {timestamp(issued.expiresAt)}</p>
          <button className={`${buttonClass} mt-3`} onClick={() => setIssued(null)}>Hide Code</button>
        </div>}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Transfer history and approvals</h2>
        <div className="space-y-3">
          {history?.transfers.map((transfer) => {
            const reviewable = Boolean(transfer.status === "pending" && transfer.requested_at && transfer.target_device_id && transfer.target_sub_id && !transfer.decided_at && new Date(transfer.expires_at).getTime() > now);
            return <article key={transfer.id} className="rounded-lg border border-white/10 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-pink-100">{transfer.status}</span><span className="break-all text-xs text-zinc-500">{transfer.id}</span></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="text-zinc-500">From</p><p>{transfer.source_username ?? "Unknown user"} / {transfer.source_device_name ?? "Unnamed device"}</p><p className="break-all text-xs text-zinc-500">User: {transfer.source_sub_id}<br />Device: {transfer.source_device_id}</p></div>
                <div><p className="text-zinc-500">To</p><p>{transfer.target_username ?? "Awaiting recipient"} / {transfer.target_device_name ?? "No device recorded"}</p><p className="break-all text-xs text-zinc-500">User: {transfer.target_sub_id ?? "-"}<br />Device: {transfer.target_device_id ?? "-"}</p></div>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2"><p>Created: {timestamp(transfer.created_at)}</p><p>Expires: {timestamp(transfer.expires_at)}</p><p>Requested: {timestamp(transfer.requested_at)}</p><p>Decided: {timestamp(transfer.decided_at)}</p></div>
              {reviewable && <div className="mt-3 flex gap-2"><button className={buttonClass} disabled={busy || !fresh} onClick={() => decide(transfer, "approve")}>Approve</button><button className={buttonClass} disabled={busy || !fresh} onClick={() => decide(transfer, "reject")}>Reject</button></div>}
            </article>;
          })}
          {fresh && history?.transfers.length === 0 && <p className="text-sm text-zinc-400">No transfers recorded.</p>}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Lock audit events</h2>
        <div className="space-y-2">{history?.events.map((event) => <article key={event.id} className="rounded-md border border-white/10 p-3 text-sm"><p className="break-all font-semibold">{event.event_type} <span className="font-normal text-zinc-400">by {event.actor}</span></p><p className="mt-1 break-all text-xs text-zinc-500">{timestamp(event.created_at)} / Transfer: {event.transfer_id}</p></article>)}</div>
        {fresh && history?.events.length === 0 && <p className="text-sm text-zinc-400">No audit events recorded.</p>}
      </section>
    </div>
  );
}
