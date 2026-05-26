"use client";

import Link from "next/link";
import { useState } from "react";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";

export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [command, setCommand] = useState("/give 500 @littledevotee");
  const [status, setStatus] = useState("");
  const [defneMessage, setDefneMessage] = useState(
    "Admin ledger ready. Be precise.",
  );
  const [isBusy, setIsBusy] = useState(false);

  const handleAdminLogin = () => {
    if (!adminPassword.trim()) {
      setStatus("Enter ADMIN_PASSWORD to unlock the console.");
      return;
    }

    setIsAdminLoggedIn(true);
    setStatus("Admin console unlocked for this browser session.");
  };

  const handleRunCommand = async () => {
    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/give", {
        body: JSON.stringify({ adminPassword, command }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Admin command failed.");
      }

      setStatus(result.message ?? "Command completed.");
      setDefneMessage("Coins added. Try not to waste my generosity.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Invalid command. Use: /give 500 @username",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
      <section className="relative mx-auto max-w-3xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
              Admin Console
            </p>
            <h1 className="text-3xl font-black">Vault Coin Grants</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Prototype-only tool backed by Supabase. Use a secure admin auth
              system before production.
            </p>
          </div>
          <Link
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
            href="/"
          >
            Dashboard
          </Link>
        </div>

        {!isAdminLoggedIn ? (
          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                ADMIN_PASSWORD
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
                onChange={(event) => setAdminPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleAdminLogin();
                  }
                }}
                type="password"
                value={adminPassword}
              />
            </label>
            <button
              className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)]"
              onClick={handleAdminLogin}
              type="button"
            >
              Unlock Admin
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Command Console
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Available command: /give amount @username
            </p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 font-mono text-sm text-pink-100">
                <span className="text-fuchsia-300">&gt;</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-pink-50 outline-none placeholder:text-zinc-600"
                  onChange={(event) => setCommand(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleRunCommand();
                    }
                  }}
                  placeholder="/give 500 @username"
                  value={command}
                />
              </label>
              <button
                className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onClick={() => void handleRunCommand()}
                type="button"
              >
                {isBusy ? "Running" : "Run"}
              </button>
            </div>
          </div>
        )}

        {status && (
          <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
            {status}
          </p>
        )}
      </section>
      <FloatingDefneBubble message={defneMessage} />
    </main>
  );
}
