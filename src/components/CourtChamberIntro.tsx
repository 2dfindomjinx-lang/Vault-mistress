import styles from "./CourtIntegrated.module.css";
import { DASHBOARD_PAGE_CODES, type DashboardPage } from "@/lib/dashboard-navigation";

type ChamberPage = Exclude<DashboardPage, "home">;

const chamberCopy: Record<ChamberPage, { code: string; eyebrow: string; title: string; description: string }> = {
  tribute: { code: DASHBOARD_PAGE_CODES.tribute, eyebrow: "You know why you're here", title: "Pay Your Tribute", description: "Choose the amount. Principessa will decide whether it is enough." },
  tasks: { code: DASHBOARD_PAGE_CODES.tasks, eyebrow: "She gave you instructions", title: "Games", description: "Skill, nerve, obedience. Earn your Coins." },
  wheels: { code: DASHBOARD_PAGE_CODES.wheels, eyebrow: "Her hand on the wheel", title: "Gamble & Wheels", description: "Spin if you dare. Whatever it lands on, you owe her." },
  pet: { code: DASHBOARD_PAGE_CODES.pet, eyebrow: "Remember what you are", title: "Pet Training", description: "Earn the collar. Keep her approval." },
  debt: { code: DASHBOARD_PAGE_CODES.debt, eyebrow: "You agreed to this", title: "Your Contracts", description: "Your agreements. Your commitments." },
  devotion: { code: DASHBOARD_PAGE_CODES.devotion, eyebrow: "Attention must be earned", title: "Your Devotion", description: "Devotion leaves a mark." },
  shop: { code: DASHBOARD_PAGE_CODES.shop, eyebrow: "Spend for her approval", title: "Principessa's Shop", description: "Titles, privileges and a look worth her attention." },
  moneyShop: { code: DASHBOARD_PAGE_CODES.moneyShop, eyebrow: "No luck required", title: "Money Shop", description: "Her finest pieces. Yours for a price." },
  crates: { code: DASHBOARD_PAGE_CODES.crates, eyebrow: "Feeling lucky?", title: "The Vault", description: "Coveted pieces. Sealed possibilities." },
  runway: { code: DASHBOARD_PAGE_CODES.runway, eyebrow: "Let her see you dressed", title: "The Runway", description: "Dress to be noticed." },
  collection: { code: DASHBOARD_PAGE_CODES.collection, eyebrow: "What she lets you keep", title: "The Collection", description: "Every piece, earned. Every glimpse, hers." },
  profile: { code: DASHBOARD_PAGE_CODES.profile, eyebrow: "This is how she sees you", title: "Your Profile", description: "Your identity in her court." },
};

export function CourtChamberIntro({page}:{page:ChamberPage}) { const copy=chamberCopy[page]; return <header className={styles.heading}><div><h1>{copy.title}</h1><p>{copy.description}</p></div><span>{copy.eyebrow}</span></header>; }
