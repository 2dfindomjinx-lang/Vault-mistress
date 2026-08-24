import Image from "next/image";
import type { ReactNode } from "react";

export function GambleWheelsLobby({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2.6rem] border border-fuchsia-300/25 bg-[#09020b] shadow-[0_35px_120px_rgba(112,10,85,.38)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_12%,rgba(255,29,157,.24),transparent_28%),radial-gradient(circle_at_90%_34%,rgba(124,58,237,.24),transparent_26%),linear-gradient(180deg,#160617,#080209_48%,#050206)]" />

      <header className="relative min-h-[28rem] overflow-hidden border-b border-pink-300/20 sm:min-h-[32rem]">
        <Image
          alt="Principessa presiding over her casino floor"
          className="object-cover object-[63%_center] opacity-95"
          fill
          priority
          quality={75}
          sizes="(min-width: 1024px) calc(100vw - 360px), 100vw"
          src="/gamble/principessa-casino-hero.webp"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,1,7,.99)_0%,rgba(8,2,10,.9)_34%,rgba(7,2,9,.12)_69%,rgba(7,2,9,.28)_100%)] sm:bg-[linear-gradient(90deg,rgba(5,1,7,.99)_0%,rgba(8,2,10,.84)_37%,rgba(7,2,9,.02)_74%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_32%,rgba(255,38,164,.2),transparent_31%),radial-gradient(circle_at_92%_72%,rgba(34,211,238,.13),transparent_23%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#09020b] via-[#09020b]/68 to-transparent" />

        <div className="absolute inset-x-4 top-4 flex items-center justify-between rounded-full border border-pink-200/15 bg-black/35 px-4 py-2 backdrop-blur-md sm:inset-x-7">
          <p className="text-[9px] font-black uppercase tracking-[.34em] text-pink-200/75">Principessa&apos;s royal arcade</p>
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.18em] text-white/45">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" /> The house is awake
          </div>
        </div>

        <div className="relative z-10 flex min-h-[28rem] max-w-2xl flex-col justify-end px-6 pb-14 pt-24 sm:min-h-[32rem] sm:px-10 sm:pb-16 lg:px-14">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-300/45 bg-pink-500/15 text-2xl text-pink-200 shadow-[0_0_28px_rgba(236,72,153,.38)]">♛</span>
            <div>
              <p className="font-serif text-lg font-semibold text-white">Principessa&apos;s Casino Court</p>
              <p className="text-[8px] font-black uppercase tracking-[.38em] text-pink-300">Choose · risk · entertain her</p>
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[.34em] text-[#f6c66f]">Tonight&apos;s audience: you</p>
          <h1 className="mt-3 max-w-xl font-serif text-5xl font-black leading-[.88] text-white [text-shadow:0_0_34px_rgba(255,41,157,.38)] sm:text-7xl">
            Every game is <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,192,229,.9)]">Her Stage.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-pink-50/60 sm:text-base">
            Pick a table, step beneath the lights and let Principessa turn every result into a little performance.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["7 live tables", "4 verdict wheels", "odds shown before play"].map((label) => (
              <span className="rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/70 backdrop-blur" key={label}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-5 bottom-3 flex justify-between sm:inset-x-9">
          {Array.from({ length: 18 }, (_, index) => (
            <span
              className="h-1.5 w-1.5 rounded-full bg-pink-200/70 shadow-[0_0_9px_#ec4899]"
              key={index}
            />
          ))}
        </div>
      </header>

      <div className="relative space-y-5 p-3 sm:p-5 lg:p-7">{children}</div>
    </section>
  );
}
