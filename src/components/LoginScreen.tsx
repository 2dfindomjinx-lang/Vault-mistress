"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type LoginScreenProps = {
  error?: string;
  isBusy?: boolean;
  onEnterPreviewMode: (unlocked: boolean) => void;
  onPreviewOverrideSubmit: (password: string) => Promise<{ error?: string; ok: boolean }>;
  onSignInWithX: () => Promise<void>;
};

export function LoginScreen({
  error,
  isBusy = false,
  onEnterPreviewMode,
  onPreviewOverrideSubmit,
  onSignInWithX,
}: LoginScreenProps) {
  const [previewPassword, setPreviewPassword] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [isPreviewChecking, setIsPreviewChecking] = useState(false);

  const handleUnlockedPreview = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const password = previewPassword.trim();

    if (!password) {
      setPreviewError("Enter the preview override password.");
      return;
    }

    setIsPreviewChecking(true);
    setPreviewError("");

    try {
      const result = await onPreviewOverrideSubmit(password);

      if (!result.ok) {
        setPreviewError(result.error ?? "Preview override failed.");
        return;
      }

      onEnterPreviewMode(true);
    } finally {
      setIsPreviewChecking(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06030a] px-4 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(236,72,153,0.28),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(168,85,247,0.2),transparent_32%),linear-gradient(180deg,#16081f,#06030a_70%)]" />

      <section className="relative w-full max-w-md rounded-[2rem] border border-pink-200/20 bg-black/55 p-6 text-center shadow-[0_0_60px_rgba(236,72,153,0.22)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.38em] text-fuchsia-200/70">
          Principessa
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

        <button
          className="mt-3 w-full rounded-2xl border border-pink-200/20 bg-white/[0.05] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-pink-50 transition hover:border-pink-300/50 hover:bg-pink-500/10"
          onClick={() => onEnterPreviewMode(false)}
          type="button"
        >
          Continue in Preview Mode
        </button>

        <div className="mt-4 rounded-2xl border border-fuchsia-200/15 bg-black/35 p-3 text-left">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-100/70">
            Testing Override
          </p>
          <form className="mt-3 flex gap-2" onSubmit={(event) => void handleUnlockedPreview(event)}>
            <input
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-300/55"
              onChange={(event) => setPreviewPassword(event.target.value)}
              placeholder="Preview password"
              type="password"
              value={previewPassword}
            />
            <button
              className="rounded-xl border border-pink-200/20 bg-pink-500/10 px-3 py-2 text-xs font-black text-pink-50 transition hover:border-pink-300/50"
              disabled={isPreviewChecking || !previewPassword.trim()}
              type="submit"
            >
              {isPreviewChecking ? "Checking" : "Unlock"}
            </button>
          </form>
          {previewError && (
            <p className="mt-2 text-xs font-semibold text-red-100">{previewError}</p>
          )}
        </div>

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
          Passwords are not collected by this app. X account data is handled by
          Supabase Auth for login and account management.
        </p>
      </section>
    </main>
  );
}
