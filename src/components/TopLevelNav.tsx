import Link from "next/link";
import { ColorModeToggle } from "./ColorModeToggle";
export function TopLevelNav({ active }: { active: "feed" | "main" }) {
 return <nav className="bb-system-bar" aria-label="Court and social"><span className="bb-system-name"><span aria-hidden="true">✧</span> Vault Mistress <small>Bubblegum OS</small></span><div><Link href="/" aria-current={active === "main" ? "page" : undefined}>My desktop</Link><Link href="/principessa-feed" aria-current={active === "feed" ? "page" : undefined}>Principessa Social ↗</Link><ColorModeToggle /></div></nav>;
}
