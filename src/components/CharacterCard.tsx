import Image from "next/image";

type CharacterCardProps = {
  dailyMessage: string;
};

export function CharacterCard({ dailyMessage }: CharacterCardProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-200/20 bg-[linear-gradient(145deg,rgba(20,8,28,0.96),rgba(78,13,68,0.52),rgba(5,3,8,0.98))] p-4 shadow-[0_0_60px_rgba(236,72,153,0.18)]">
      <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative">
        <div className="relative min-h-[460px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
          <Image
            alt="Principessa, a stylish SFW anime mistress character placeholder"
            className="object-cover object-top"
            fill
            unoptimized
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            src="/character.png"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-pink-200">
              Your Greedy Mistress
            </p>
            <h2 className="mt-1 text-5xl font-black tracking-normal text-white">
              Principessa
            </h2>
            <p className="mt-3 max-w-md rounded-2xl border border-pink-200/20 bg-black/50 p-4 text-sm leading-6 text-pink-50 shadow-[0_0_24px_rgba(236,72,153,0.18)] backdrop-blur">
              {dailyMessage}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-pink-200/15 bg-black/35 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/70">
            Vault Status
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Earn slowly, choose carefully, and spend fantasy coins to raise
            affection or unlock SFW gallery cards.
          </p>
        </div>
      </div>
    </section>
  );
}
