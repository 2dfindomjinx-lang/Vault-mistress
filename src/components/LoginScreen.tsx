"use client";

import { useState } from "react";
import { isSupabaseConfigured, normalizeUsername } from "@/lib/supabase/client";

type LoginMode = "login" | "register";

type LoginScreenProps = {
  error?: string;
  isBusy?: boolean;
  onSubmit: (
    mode: LoginMode,
    username: string,
    password: string,
  ) => Promise<void>;
};

export function LoginScreen({ error, isBusy = false, onSubmit }: LoginScreenProps) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [username, setUsername] = useState("@littledevotee");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(mode, normalizeUsername(username), password);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06030a] px-4 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(236,72,153,0.28),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(168,85,247,0.2),transparent_32%),linear-gradient(180deg,#16081f,#06030a_70%)]" />

      <section className="relative w-full max-w-md rounded-[2rem] border border-pink-200/20 bg-black/55 p-6 text-center shadow-[0_0_60px_rgba(236,72,153,0.22)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.38em] text-fuchsia-200/70">
          Defne
        </p>
        <h1 className="mt-3 text-5xl font-black tracking-normal text-white">
          Vault Mistress
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-zinc-300">
          Enter the velvet ledger with your vault username. Coins, mood, and
          unlocks are now saved through Supabase.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
          {(["login", "register"] as LoginMode[]).map((option) => (
            <button
              className={`rounded-xl px-4 py-2 text-sm font-black uppercase tracking-[0.14em] transition ${
                mode === option
                  ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_18px_rgba(236,72,153,0.28)]"
                  : "text-zinc-400 hover:text-pink-100"
              }`}
              key={option}
              onClick={() => setMode(option)}
              type="button"
            >
              {option === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        <form className="mt-5 grid gap-4 text-left" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Username
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@littledevotee"
              required
              value={username}
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Password
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              required
              type="password"
              value={password}
            />
          </label>

          <button
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(236,72,153,0.35)] transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy || !isSupabaseConfigured}
            type="submit"
          >
            {isBusy
              ? "Opening Vault..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Username is stored visibly; internally it becomes a private vault
          email like littledevotee@vault.local for Supabase Auth.
        </p>
      </section>
    </main>
  );
}
