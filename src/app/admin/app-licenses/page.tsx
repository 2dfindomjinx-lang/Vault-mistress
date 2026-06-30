"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LicenseRow = {
  id: string;
  activation_code: string;
  status: "active" | "revoked";
  owner_name: string | null;
  notes: string | null;
  bound_installation_id: string | null;
  bound_device_label: string | null;
  bound_at: string | null;
  last_validated_at: string | null;
  reset_count: number;
  created_at: string;
};

type EventRow = {
  id: string;
  activation_code_snapshot: string | null;
  owner_name_snapshot: string | null;
  event_type: string;
  installation_id: string | null;
  device_label: string | null;
  created_at: string;
};

export default function AppLicensesPage() {
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<LicenseRow | null>(null);

  const loadLicenses = async () => {
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/app-licenses", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        licenses?: LicenseRow[];
        events?: EventRow[];
      };
      if (!response.ok) {
        throw new Error(result.error ?? "License list failed.");
      }
      setLicenses(result.licenses ?? []);
      setEvents(result.events ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "License list failed.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;

    const boot = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const result = (await response.json()) as { error?: string; isAdmin?: boolean };
        if (!alive) return;
        if (!response.ok || !result.isAdmin) {
          setStatus(result.error ?? "Admin access required.");
          setIsAdmin(false);
          return;
        }
        setIsAdmin(true);
        await loadLicenses();
      } catch (error) {
        if (alive) {
          setStatus(error instanceof Error ? error.message : "Admin session failed.");
          setIsAdmin(false);
        }
      } finally {
        if (alive) {
          setIsCheckingAdmin(false);
        }
      }
    };

    void boot();
    return () => {
      alive = false;
    };
  }, []);

  const runAction = async (body: Record<string, unknown>, successMessage: string) => {
    setIsBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/app-licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        licenses?: LicenseRow[];
        events?: EventRow[];
      };
      if (!response.ok) {
        throw new Error(result.error ?? "License action failed.");
      }
      setLicenses(result.licenses ?? []);
      setEvents(result.events ?? []);
      setStatus(successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "License action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  if (isCheckingAdmin) {
    return (
      <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
        <section className="mx-auto max-w-6xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-6 text-sm text-zinc-300">
          Checking admin access...
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
        <section className="mx-auto max-w-6xl rounded-[2rem] border border-rose-200/15 bg-black/55 p-6">
          <p className="text-sm font-semibold text-rose-100">{status || "Admin access required."}</p>
          <Link className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200" href="/admin">
            Back to admin
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
      <section className="relative mx-auto max-w-6xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">Activation Codes</p>
            <h1 className="text-3xl font-black">Principessa&apos;s Discipline Licenses</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Generate a code, see who used it, and reset or revoke it when needed.
            </p>
          </div>
          <Link className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white" href="/admin">
            Back to admin
          </Link>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm text-zinc-300">
              Notes
              <input
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional buyer note"
                value={notes}
              />
            </label>
            <button
              className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy}
              onClick={() => void runAction({ action: "generate", notes }, "New activation code generated.")}
              type="button"
            >
              Generate an Activation Code
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">Activation codes</p>
              <button
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                disabled={isBusy}
                onClick={() => void loadLicenses()}
                type="button"
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {licenses.length > 0 ? (
                licenses.map((license) => (
                  <article className="rounded-2xl border border-white/10 bg-black/35 p-4" key={license.id}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-mono text-lg font-black tracking-[0.18em] text-pink-50">{license.activation_code}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                          <span className={`rounded-full border px-3 py-1 font-black uppercase ${license.status === "active" ? "border-emerald-200/20 bg-emerald-400/10 text-emerald-100" : "border-rose-200/20 bg-rose-500/10 text-rose-100"}`}>
                            {license.status}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                            resets {license.reset_count}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                            created {new Date(license.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-zinc-300">
                          Unique name: <span className="font-semibold text-white">{license.owner_name || "not activated yet"}</span>
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">{license.notes || "No note"}</p>
                        <p className="mt-2 text-xs text-zinc-500">
                          {license.bound_installation_id
                            ? `Bound to ${license.bound_device_label || "unknown device"} on ${license.bound_at ? new Date(license.bound_at).toLocaleString() : "unknown time"}`
                            : "Not bound to any device yet."}
                        </p>
                        {license.last_validated_at && (
                          <p className="mt-1 text-xs text-zinc-500">Last validated {new Date(license.last_validated_at).toLocaleString()}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-2xl border border-sky-200/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-100 transition hover:border-sky-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => setResetTarget(license)}
                          type="button"
                        >
                          Reset
                        </button>
                        <button
                          className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isBusy || license.status === "revoked" || Boolean(license.owner_name || license.bound_installation_id || license.bound_at || license.last_validated_at || license.reset_count > 0)}
                          onClick={() => void runAction({ action: "revoke", licenseId: license.id }, "Unused activation code deleted.")}
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                  No activation codes yet.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">Recent activation log</p>
            <p className="mt-2 text-xs text-zinc-500">Showing the latest 50 entries.</p>
            <div className="mt-4 grid gap-3">
              {events.length > 0 ? (
                events.map((event) => (
                  <article className="rounded-2xl border border-white/10 bg-black/35 p-3" key={event.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-pink-50">
                        {event.event_type}
                      </span>
                      {event.activation_code_snapshot && (
                        <span className="font-mono text-xs text-zinc-300">{event.activation_code_snapshot}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-white">{event.owner_name_snapshot || "No unique name yet"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(event.created_at).toLocaleString()}</p>
                    {event.device_label && (
                      <p className="mt-1 text-xs text-zinc-500">{event.device_label}</p>
                    )}
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                  No activation log yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {status && (
          <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
            {status}
          </p>
        )}
      </section>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-pink-200/20 bg-[#09040d] p-5 shadow-[0_0_44px_rgba(217,70,239,0.14)]">
            <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">Confirm reset</p>
            <h2 className="mt-2 font-mono text-lg font-black tracking-[0.14em] text-pink-50">
              {resetTarget.activation_code}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              This will clear the current binding and let the code be activated again.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-zinc-200"
                disabled={isBusy}
                onClick={() => setResetTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl border border-sky-200/20 bg-sky-500/10 px-4 py-2 text-sm font-black text-sky-100 transition hover:border-sky-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onClick={() => {
                  const licenseId = resetTarget.id;
                  setResetTarget(null);
                  void runAction({ action: "reset", licenseId }, "License reset. The next user can activate it.");
                }}
                type="button"
              >
                Confirm reset
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
