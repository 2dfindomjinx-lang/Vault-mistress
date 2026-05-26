"use client";

import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type LoginScreenProps = {
  onLogin: () => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { data: session, status } = useSession();
  const [authClickDebug, setAuthClickDebug] = useState("");
  const [authClickError, setAuthClickError] = useState("");

  const handleRealXLogin = async () => {
    console.log("Real X login clicked");
    setAuthClickDebug("Clicked real X login");
    setAuthClickError("");

    const result = await signIn("twitter", {
      callbackUrl: "/",
      redirect: false,
    });

    console.log("signIn result", result);
    setAuthClickDebug(JSON.stringify(result, null, 2));

    if (result?.error) {
      setAuthClickError(result.error);
    }

    if (result?.url) {
      window.location.href = result.url;
    }
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
          Enter the velvet ledger with a prototype X identity. The vault remembers
          fantasy coins only.
        </p>

        <button
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(236,72,153,0.35)] transition hover:scale-[1.01]"
          onClick={onLogin}
          type="button"
        >
          Continue with X
        </button>

        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Prototype login stays active. Real X OAuth test is separate below.
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-pink-200/15 bg-black/45 p-4 text-left">
          <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
            Real X OAuth Test
          </p>
          <button
            className="mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-pink-50 transition hover:border-pink-300/50 hover:bg-pink-500/20"
            onClick={handleRealXLogin}
            type="button"
          >
            Test Real X Login
          </button>
          {authClickDebug && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-2xl border border-white/10 bg-black/60 p-3 text-xs leading-5 text-pink-100">
              {authClickDebug}
            </pre>
          )}
          {authClickError && (
            <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {authClickError}
            </p>
          )}

          <Link
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-fuchsia-200/20 bg-white/[0.04] px-5 py-3 text-center text-sm font-bold text-fuchsia-100 transition hover:border-fuchsia-300/50"
            href="/api/auth/signin/twitter"
          >
            Direct NextAuth Twitter Sign In
          </Link>

          {session && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-100">
              {session.user?.image && (
                <Image
                  alt={session.user.name ?? "X profile image"}
                  className="rounded-full"
                  height={40}
                  src={session.user.image}
                  unoptimized
                  width={40}
                />
              )}
              <div>
                <p className="font-bold">Real X session detected.</p>
                <p>{session.user?.name ?? "X user"}</p>
              </div>
            </div>
          )}

          <dl className="mt-4 grid gap-2 text-xs text-zinc-400">
            <div className="flex justify-between gap-4">
              <dt>NextAuth status</dt>
              <dd className="text-pink-100">{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>session exists</dt>
              <dd className="text-pink-100">{session ? "yes" : "no"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>name</dt>
              <dd className="text-right text-pink-100">
                {session?.user?.name ?? "none"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>image</dt>
              <dd className="max-w-[220px] truncate text-right text-pink-100">
                {session?.user?.image ?? "none"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
