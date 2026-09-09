import Image from "next/image";
import { DASHBOARD_PAGE_CODES, type DashboardPage } from "@/lib/dashboard-navigation";

type ChamberPage = Exclude<DashboardPage, "home">;

const chamberCopy: Record<ChamberPage, { code: string; eyebrow: string; title: string; description: string }> = {
  tribute: { code: DASHBOARD_PAGE_CODES.tribute, eyebrow: "You know why you're here", title: "Pay Your Tribute", description: "Choose the amount. Principessa will decide whether it is enough." },
  tasks: { code: DASHBOARD_PAGE_CODES.tasks, eyebrow: "She gave you instructions", title: "Games", description: "Finish what she assigned. Excuses do not count as proof." },
  wheels: { code: DASHBOARD_PAGE_CODES.wheels, eyebrow: "Her hand on the wheel", title: "Gamble & Wheels", description: "Spin if you dare. Whatever it lands on, you owe her." },
  pet: { code: DASHBOARD_PAGE_CODES.pet, eyebrow: "Remember what you are", title: "Pet Training", description: "Obedience is tracked. Progress is noticed. Disappointing her is remembered." },
  debt: { code: DASHBOARD_PAGE_CODES.debt, eyebrow: "You agreed to this", title: "What You Owe", description: "Every coin, deadline and missed payment stays here until the balance is cleared." },
  devotion: { code: DASHBOARD_PAGE_CODES.devotion, eyebrow: "Attention must be earned", title: "Your Devotion", description: "Your rank reflects what you have actually given her—not what you claim." },
  shop: { code: DASHBOARD_PAGE_CODES.shop, eyebrow: "Spend for her approval", title: "Principessa's Shop", description: "Use your coins on privileges, cosmetics and whatever she allows you to keep." },
  moneyShop: { code: DASHBOARD_PAGE_CODES.moneyShop, eyebrow: "No luck required", title: "Money Shop", description: "Principessa Money buys the Legendary outright. Coins never reach this counter." },
  crates: { code: DASHBOARD_PAGE_CODES.crates, eyebrow: "Feeling lucky?", title: "Open a Case", description: "Take your chance. Principessa still decides what the result is worth." },
  runway: { code: DASHBOARD_PAGE_CODES.runway, eyebrow: "Let her see you dressed", title: "The Runway", description: "Submit your look, vote on others, and see who she'd actually notice." },
  collection: { code: DASHBOARD_PAGE_CODES.collection, eyebrow: "What she lets you keep", title: "Your Gallery", description: "The moments and rewards Principessa has allowed you to keep." },
  profile: { code: DASHBOARD_PAGE_CODES.profile, eyebrow: "This is how she sees you", title: "Your Profile", description: "Your name, titles, devotion and everything you have done for her." },
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
  wheels: {
    alt: "Principessa watching the wheel decide",
    caption: "The wheel only says out loud what she already decided.",
    imageClassName: "origin-bottom translate-y-[4%] scale-[1.01] object-bottom",
    src: "/principessa-ui/generated/principessa-shrine-offering.webp",
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
  moneyShop: {
    alt: "Principessa beside luxury shopping bags, holding the court card",
    caption: "No spinning. Just pay.",
    imageClassName: "origin-bottom translate-y-[4%] scale-[1.01] object-bottom",
    src: "/principessa-ui/generated/principessa-shop-bags.webp",
  },
  crates: {
    alt: "Principessa presenting a sealed court case",
    caption: "Open it. Accept what you get.",
    imageClassName: "origin-bottom scale-[1.04] object-bottom",
    src: "/principessa-ui/generated/principessa-case-present.webp",
  },
  runway: {
    alt: "Principessa walking down her velvet runway podium",
    caption: "Let's see what you put together.",
    imageClassName: "origin-bottom scale-[1.02] object-bottom",
    src: "/principessa-ui/generated/principessa-runway-podium.png",
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
    <section className="court-chamber-hero" aria-labelledby="chamber-title">
      <div className="court-chamber-arch" aria-hidden="true" />
      <div className="court-chamber-copy">
        <p className="court-eyebrow">{copy.eyebrow}</p>
        <h1 id="chamber-title">{copy.title}</h1>
        <p className="court-chamber-description">{copy.description}</p>
        <p className="court-chamber-caption">“{moment.caption}”</p>
      </div>
      <div className="court-chamber-portrait">
        <Image alt={moment.alt} className={`object-contain ${moment.imageClassName}`} fill sizes="(min-width: 1024px) 36vw, (min-width: 640px) 42vw, 55vw" src={moment.src} />
      </div>
      <span className="court-chamber-number" aria-hidden="true">{copy.code}</span>
    </section>
  );
}
