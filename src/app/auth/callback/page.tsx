"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const finishOAuth = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const providerError = searchParams.get("error");
      const providerDescription = searchParams.get("error_description");
      const code = searchParams.get("code");

      if (providerError) {
        const message =
          providerDescription ?? `OAuth provider returned ${providerError}.`;

        console.error("Supabase OAuth callback provider error", {
          error: providerError,
          description: providerDescription,
        });
        setErrorMessage(message);
        return;
      }

      if (!code) {
        console.error("Supabase OAuth callback missing code", {
          url: window.location.href,
        });
        setErrorMessage("OAuth callback is missing a code.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Supabase OAuth session exchange failed", error);
        setErrorMessage(error.message);
        return;
      }

      router.replace("/");
    };

    void finishOAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06030a] px-4 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-pink-200/20 bg-black/55 p-6 text-center shadow-[0_0_60px_rgba(236,72,153,0.22)]">
        <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">
          Vault Mistress
        </p>
        <h1 className="mt-3 text-3xl font-black">
          {errorMessage ? "Login Failed" : "Opening Vault"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-300">
          {errorMessage ||
            "Completing the Supabase X OAuth session. Defne is checking the ledger."}
        </p>
        {errorMessage && (
          <Link
            className="mt-6 inline-flex rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white"
            href="/"
          >
            Back to Login
          </Link>
        )}
      </section>
    </main>
  );
}
