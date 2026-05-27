"use client";

import { isSupabaseConfigured } from "@/lib/supabase/client";

type LoginScreenProps = {
  error?: string;
  isBusy?: boolean;
  onSignInWithX: () => Promise<void>;
};

export function LoginScreen({
  error,
  isBusy = false,
  onSignInWithX,
}: LoginScreenProps) {
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
          Sign in with X to enter the vault. Supabase handles OAuth and stores
          your session securely.
        </p>

        <button
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(236,72,153,0.35)] transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy || !isSupabaseConfigured}
          onClick={() => void onSignInWithX()}
          type="button"
        >
          {isBusy ? "Redirecting..." : "Sign in with X"}
        </button>

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
          No email or password is collected by this app. Configure the X provider
          in Supabase Auth and allow /auth/callback as a redirect URL.
        </p>
      </section>
    </main>
  );
}
