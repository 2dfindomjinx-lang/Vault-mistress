import Link from "next/link";
import styles from "./CourtChrome.module.css";
export function TopLevelNav({ active }: { active: "feed" | "main" }) {
 return <nav className={styles.topbar} aria-label="Court and social"><span className={styles.topIdentity}>All eyes on her.</span><div className={styles.topLinks}><Link href="/" aria-current={active === "main" ? "page" : undefined}>The Court</Link><Link href="/principessa-feed" aria-current={active === "feed" ? "page" : undefined}>Principessa Social ↗</Link></div></nav>;
}
