"use client";

import Image from "next/image";

type LoginScreenProps = {
  error?: string;
  isBusy?: boolean;
  onEnterPreviewMode: () => void;
  onSignInWithX: () => Promise<void>;
};

export function LoginScreen({
  error,
  isBusy = false,
  onEnterPreviewMode,
  onSignInWithX,
}: LoginScreenProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060305] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(190,24,93,.22),transparent_28%),linear-gradient(112deg,#070405,#170810_52%,#050304)]" />
      <div className="relative mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.15fr_.85fr]">
        <section className="relative hidden overflow-hidden border-r border-[#c89a55]/15 lg:block">
          <div className="absolute inset-0 bg-[url('/principessa-ui/principessa-gaze.jpeg')] bg-cover bg-center opacity-35" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,3,5,.2),rgba(6,3,5,.8)),linear-gradient(0deg,#060305,transparent_50%)]" />
          <div className="absolute -bottom-40 right-[-6%] h-[92%] w-[55%]"><Image alt="Principessa awaiting entry to her court" className="object-contain object-bottom drop-shadow-[-20px_20px_36px_rgba(0,0,0,.8)]" fill priority sizes="42vw" src="/principessa-ui/principessa-court-model.png" /></div>
          <div className="relative z-10 flex h-full max-w-xl flex-col justify-between p-12">
            <div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#d7ad69]/70">Private domain</p><h1 className="mt-5 font-serif text-7xl leading-[.86] text-[#fff0d2]">The court is already watching.</h1></div>
            <p className="max-w-sm border-l border-pink-400/30 pl-4 font-serif text-lg italic leading-8 text-pink-100/45">Enter only if you are ready to be measured by her standards.</p>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-md border border-[#c89a55]/20 bg-black/35 p-7 shadow-[0_30px_90px_rgba(0,0,0,.52)] sm:p-9">
            <div className="relative mb-7 h-32 overflow-hidden border border-[#c89a55]/15 lg:hidden"><Image alt="Principessa" className="object-cover object-center" fill priority sizes="420px" src="/principessa-ui/principessa-gaze.jpeg" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /></div>
            <p className="text-[9px] font-black uppercase tracking-[0.38em] text-[#d7ad69]/65">Principessa&apos;s Court</p>
            <h2 className="mt-3 font-serif text-5xl leading-none text-[#fff0d2]">Request entry.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-500">Your X identity opens the court record assigned to you. Authentication remains secured by Supabase.</p>

        <button
          className="mt-8 w-full border border-pink-300/30 bg-[#7f1747] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition enabled:hover:bg-[#951b54] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy}
          onClick={() => void onSignInWithX()}
          type="button"
        >
          {isBusy ? "Redirecting..." : "Sign in with X"}
        </button>

        <button
          className="mt-3 w-full border border-[#c89a55]/20 bg-white/[0.025] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#e9d2aa] transition hover:border-[#c89a55]/45 hover:bg-[#c89a55]/[.06]"
          onClick={onEnterPreviewMode}
          type="button"
        >
          Continue in Preview Mode
        </button>

        {/* TEMP_UI_PREVIEW — REMOVE BEFORE RELEASE */}
        {error && (
          <p className="mt-4 border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        <p className="mt-5 border-t border-[#c89a55]/10 pt-4 text-[10px] leading-5 text-zinc-700">
          Passwords are not collected by this app. X account data is handled by
          Supabase Auth for login and account management.
        </p>
          </div>
        </section>
      </div>
    </main>
  );
}
