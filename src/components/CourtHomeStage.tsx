"use client";

import Image from "next/image";
import { CoinAmount } from "@/components/CoinAmount";
import type { DashboardPage } from "@/components/SidebarNav";

type CourtHomeStageProps = {
  affection: number;
  coins: number;
  dailyMessage: string;
  displayName: string;
  onNavigate: (page: DashboardPage) => void;
};

export function CourtHomeStage({ affection, coins, dailyMessage, displayName, onNavigate }: CourtHomeStageProps) {
  return (
    <section className="relative isolate min-h-[34rem] overflow-hidden border border-[#c89a55]/20 bg-[#090507] sm:min-h-[36rem] lg:min-h-[40rem]">
      <div className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(circle_at_74%_16%,rgba(190,24,93,.23),transparent_27%),linear-gradient(110deg,#080406_0%,#160811_51%,#070405_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-20 w-[58%] opacity-40 [background-image:linear-gradient(rgba(215,166,94,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(215,166,94,.04)_1px,transparent_1px)] [background-size:58px_58px] [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="absolute inset-x-8 top-7 h-px bg-gradient-to-r from-transparent via-[#d7ad69]/40 to-transparent" />

      <div className="relative z-20 flex min-h-[34rem] max-w-[62rem] flex-col justify-between p-6 sm:min-h-[36rem] sm:p-8 lg:min-h-[40rem] lg:p-12">
        <div className="max-w-xl pr-16 sm:pr-0">
          <p className="text-[8px] font-black uppercase tracking-[.28em] text-[#d7ad69]/60 sm:text-[9px] sm:tracking-[.38em]">Principessa is watching</p>
          <h1 className="mt-5 max-w-[10ch] font-serif text-[2.65rem] leading-[.9] text-[#fff0d2] sm:mt-6 sm:text-6xl xl:text-7xl">Present yourself properly.</h1>
          <p className="mt-5 max-w-lg border-l border-pink-400/30 pl-4 text-sm leading-6 text-zinc-400 sm:mt-6 sm:text-base sm:leading-7">{dailyMessage}</p>
        </div>

        <div className="relative z-30 mt-10 max-w-2xl sm:mt-12">
          <p className="mb-3 text-[8px] font-black uppercase tracking-[.32em] text-pink-200/35">What she expects from you</p>
          <div className="relative grid border border-[#c89a55]/20 bg-black/75 sm:grid-cols-[1.15fr_.85fr_.85fr]">
            <div className="border-b border-[#c89a55]/12 p-4 sm:border-b-0 sm:border-r">
              <p className="text-[8px] font-black uppercase tracking-[.22em] text-[#d7ad69]/45">Her pet</p>
              <p className="mt-1 truncate font-serif text-xl text-[#ffe8bd]">{displayName}</p>
              <p className="mt-2 text-[9px] uppercase tracking-[.14em] text-zinc-700">Do something worth her attention</p>
            </div>
            <button className="border-b border-[#c89a55]/12 p-4 text-left transition hover:bg-pink-500/[.08] sm:border-b-0 sm:border-r" onClick={() => onNavigate("tribute")} type="button">
              <p className="text-[8px] font-black uppercase tracking-[.22em] text-[#d7ad69]/45">Offer tribute</p>
              <div className="mt-2 text-sm font-black text-[#ffe8bd]"><CoinAmount amount={coins} iconSize={16} label="" /></div>
            </button>
            <button className="p-4 text-left transition hover:bg-pink-500/[.08]" onClick={() => onNavigate("tasks")} type="button">
              <p className="text-[8px] font-black uppercase tracking-[.22em] text-[#d7ad69]/45">Earn approval</p>
              <p className="mt-2 text-xl font-black text-[#ffe8bd]">{affection}/100</p>
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-9 top-12 z-10 h-48 w-28 opacity-55 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:-bottom-24 sm:-right-7 sm:top-auto sm:h-[92%] sm:w-[58%] sm:min-w-[23rem] sm:opacity-100 sm:[mask-image:none] lg:-bottom-28 lg:right-[3%] lg:h-[108%] lg:w-[42%]">
        <div className="absolute bottom-[8%] left-[12%] right-[6%] hidden h-28 rounded-[50%] bg-black/80 blur-2xl sm:block" />
        <Image alt="Principessa standing with her arms crossed over the command console" className="object-contain object-top sm:object-bottom" fill preload quality={82} sizes="(min-width: 1024px) 42vw, (min-width: 640px) 58vw, 112px" src="/principessa-ui/generated/principessa-home-command.png" />
      </div>

      <div className="pointer-events-none absolute bottom-[7.5rem] right-[2%] z-0 hidden h-36 w-[45%] border border-[#c89a55]/18 bg-[linear-gradient(180deg,rgba(75,13,38,.78),rgba(12,5,8,.96))] shadow-[0_-25px_50px_rgba(0,0,0,.35)] lg:block">
        <div className="absolute inset-x-8 top-5 h-px bg-gradient-to-r from-transparent via-[#d7ad69]/35 to-transparent" />
        <p className="absolute bottom-4 right-5 font-serif text-xs italic text-[#d7ad69]/35">She already knows what you should choose.</p>
      </div>
    </section>
  );
}
