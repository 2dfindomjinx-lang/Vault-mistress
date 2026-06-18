import type { ReactNode } from "react";

type PageStatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function PageStatCard({ hint, label, value }: PageStatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_0_24px_rgba(168,85,247,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200/70">
        {label}
      </p>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
