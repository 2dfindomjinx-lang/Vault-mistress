"use client";

import { signIn } from "next-auth/react";

export function LoginScreen() {
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
          Enter the velvet ledger with your X account. The vault remembers
          fantasy coins only.
        </p>

        <button
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(236,72,153,0.35)] transition hover:scale-[1.01]"
          onClick={() => signIn("twitter")}
          type="button"
        >
          Continue with X
        </button>

        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Real X OAuth is handled by NextAuth.
        </p>
      </section>
    </main>
  );
}
