import Image from "next/image";
import type { DashboardPage } from "@/components/SidebarNav";

type ChamberPage = Exclude<DashboardPage, "home">;

const chamberCopy: Record<ChamberPage, { code: string; eyebrow: string; title: string; description: string }> = {
  tribute: { code: "II", eyebrow: "You know why you're here", title: "Pay Your Tribute", description: "Choose the amount. Principessa will decide whether it is enough." },
  tasks: { code: "III", eyebrow: "She gave you instructions", title: "Your Tasks", description: "Finish what she assigned. Excuses do not count as proof." },
  pet: { code: "IV", eyebrow: "Remember what you are", title: "Pet Training", description: "Obedience is tracked. Progress is noticed. Disappointing her is remembered." },
  debt: { code: "V", eyebrow: "You agreed to this", title: "What You Owe", description: "Every coin, deadline and missed payment stays here until the balance is cleared." },
  devotion: { code: "VI", eyebrow: "Attention must be earned", title: "Your Devotion", description: "Your rank reflects what you have actually given her—not what you claim." },
  shop: { code: "VII", eyebrow: "Spend for her approval", title: "Principessa's Shop", description: "Use your coins on privileges, cosmetics and whatever she allows you to keep." },
  crates: { code: "VIII", eyebrow: "Feeling lucky?", title: "Open a Case", description: "Take your chance. Principessa still decides what the result is worth." },
  puzzle: { code: "IX", eyebrow: "Do not waste her time", title: "Solve the Puzzle", description: "Focus, finish it and give her a reason to be impressed." },
  collection: { code: "X", eyebrow: "What she lets you keep", title: "Your Gallery", description: "The moments and rewards Principessa has allowed you to keep." },
  profile: { code: "XI", eyebrow: "This is how she sees you", title: "Your Profile", description: "Your name, titles, devotion and everything you have done for her." },
};

type CharacterMoment = {
  alt: string;
  caption: string;
  imageClassName: string;
  src: string;
};

const characterMoments: Record<ChamberPage, CharacterMoment> = {
  tribute: {
    alt: "Principessa pouring gold coins from a velvet purse at the Shrine",
    caption: "Let's see if you know what enough means.",
    imageClassName: "origin-bottom translate-y-[4%] scale-[1.01] object-bottom",
    src: "/principessa-ui/generated/principessa-shrine-offering.webp",
  },
  tasks: {
    alt: "Principessa seated on the edge of the order panel",
    caption: "Do not make her repeat herself.",
    imageClassName: "origin-bottom translate-y-[7%] scale-[1.02] object-bottom",
    src: "/principessa-ui/generated/principessa-panel-sit.webp",
  },
  pet: {
    alt: "Principessa holding a collar and leash in the Pet Quarters",
    caption: "The collar looks better when it is earned.",
    imageClassName: "origin-bottom translate-y-[5%] scale-[1.04] object-bottom",
    src: "/principessa-ui/generated/principessa-pet-collar.webp",
  },
  debt: {
    alt: "Principessa offering a detailed debt contract while holding cash",
    caption: "You signed it. Now pay it.",
    imageClassName: "origin-bottom scale-[1.12] object-bottom",
    src: "/principessa-ui/generated/principessa-debt-contract.webp",
  },
  devotion: {
    alt: "Principessa recording devotion in an ornate court ledger",
    caption: "Claims mean nothing. Numbers do.",
    imageClassName: "origin-bottom scale-[1.16] object-bottom",
    src: "/principessa-ui/generated/principessa-devotion-ledger.webp",
  },
  shop: {
    alt: "Principessa inspecting a court card beside luxury shopping bags",
    caption: "Buy carefully. She is still watching.",
    imageClassName: "origin-bottom translate-y-[4%] scale-[1.01] object-bottom",
    src: "/principessa-ui/generated/principessa-shop-bags.webp",
  },
  crates: {
    alt: "Principessa presenting a sealed court case",
    caption: "Open it. Accept what you get.",
    imageClassName: "origin-bottom scale-[1.04] object-bottom",
    src: "/principessa-ui/generated/principessa-case-present.webp",
  },
  puzzle: {
    alt: "Principessa crouching as she joins two ornate puzzle pieces",
    caption: "Think before you disappoint her.",
    imageClassName: "origin-bottom scale-[1.14] object-bottom",
    src: "/principessa-ui/generated/principessa-puzzle-pieces.webp",
  },
  collection: {
    alt: "Principessa posing through an ornate gallery frame",
    caption: "Only what she allowed you to see.",
    imageClassName: "origin-bottom scale-[1.08] object-bottom",
    src: "/principessa-ui/generated/principessa-gallery-frame.webp",
  },
  profile: {
    alt: "Principessa seated with a sealed personal court dossier across her lap",
    caption: "Everything she needs to know about you.",
    imageClassName: "origin-bottom translate-y-[4%] scale-[1.02] object-bottom",
    src: "/principessa-ui/generated/principessa-profile-dossier.webp",
  },
};

export function CourtChamberIntro({ page }: { page: ChamberPage }) {
  const copy = chamberCopy[page];
  const moment = characterMoments[page];

  return (
    <section className="relative isolate overflow-hidden border-x border-b border-[#c89a55]/15 bg-[#0a0608] px-5 py-7 sm:px-8 sm:py-9 lg:min-h-[19rem]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_15%,rgba(190,24,93,.13),transparent_28%),linear-gradient(105deg,rgba(217,169,91,.025),transparent_45%)]" />
      <div className="relative z-20 flex items-start gap-4 sm:gap-7 lg:max-w-[48%]">
        <span className="mt-1 font-serif text-3xl text-[#d7ad69]/25 sm:text-4xl">{copy.code}</span>
        <div className="min-w-0 border-l border-[#c89a55]/20 pl-4 sm:pl-7">
          <p className="text-[8px] font-black uppercase tracking-[.3em] text-pink-200/40">{copy.eyebrow}</p>
          <h1 className="mt-2 font-serif text-3xl leading-none text-[#fff0d2] sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{copy.description}</p>
        </div>
      </div>

      <div className="relative mt-6 h-[19rem] overflow-hidden border border-[#c89a55]/12 bg-[radial-gradient(circle_at_55%_20%,rgba(190,24,93,.14),transparent_42%),rgba(0,0,0,.18)] lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:h-auto lg:w-[50%] lg:border-y-0 lg:border-r-0">
        <div className="absolute inset-x-5 bottom-5 top-[62%] border border-[#c89a55]/20 bg-[linear-gradient(180deg,rgba(59,12,34,.86),rgba(8,4,6,.96))] shadow-[0_-18px_45px_rgba(0,0,0,.42)]">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e3b86d]/45 to-transparent" />
          <p className="absolute bottom-3 right-4 max-w-[75%] text-right font-serif text-[11px] italic leading-4 text-[#d7ad69]/45">{moment.caption}</p>
        </div>
        <Image alt={moment.alt} className={`relative z-10 object-contain ${moment.imageClassName}`} fill quality={82} sizes="(min-width: 1024px) 50vw, 100vw" src={moment.src} />
      </div>
    </section>
  );
}
