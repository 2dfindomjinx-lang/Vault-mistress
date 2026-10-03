import type { DashboardPage } from "@/lib/dashboard-navigation";

export function MobileGlyph({ name }: { name: DashboardPage | "more" | "back" | "plus" | "arrow" | "close" }) {
  const paths: Record<typeof name, string> = {
    home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    tasks: "M5 4h14v16H5Z M9 8h6M9 12h6M9 16h3",
    wheels: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 3v5M12 16v5M3 12h5M16 12h5M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
    tribute: "m3 8 4 3 5-7 5 7 4-3-2 11H5Z M5 21h14",
    crates: "M3 8h18v13H3Z M3 8l4-5h10l4 5M3 12h18M10 12v4h4v-4",
    shop: "M5 8h14l2 13H3Z M9 8V6a3 3 0 0 1 6 0v2",
    moneyShop: "M3 6h18v12H3Z M3 10h18M16 14h2M7 14h1",
    runway: "M4 20h16M8 16l4-12 4 12M6 12h12",
    profile: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M4 21v-2a8 8 0 0 1 16 0v2",
    collection: "M3 4h18v16H3Z M3 16l6-6 5 5 3-3 4 4M16 8h.01",
    debt: "M6 3h12v18H6Z M9 7h6M9 11h6M9 15h3M14 18l2-2",
    pet: "M9 8c-2-5-5-4-4-1M15 8c2-5 5-4 4-1M12 10c-3 0-7 5-7 7 0 5 5 2 7 2s7 3 7-2c0-2-4-7-7-7Z",
    devotion: "M4 4h16v4a8 8 0 0 1-16 0ZM8 21h8M12 16v5M4 6H2v3l4 3M20 6h2v3l-4 3",
    more: "M4 6h16M4 12h16M4 18h16",
    back: "m14 5-7 7 7 7",
    plus: "M12 5v14M5 12h14",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    close: "m6 6 12 12M6 18 18 6",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
