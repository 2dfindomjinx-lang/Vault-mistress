"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type CharacterEvolutionStage = {
  id: string;
  image: string;
  label: string;
  min: number;
};

type CharacterCardProps = {
  dailyMessage: string;
  evolutionStage: CharacterEvolutionStage;
};

export function CharacterCard({ dailyMessage, evolutionStage }: CharacterCardProps) {
  const [failedStageIds, setFailedStageIds] = useState<string[]>([]);
  const [showStageReveal, setShowStageReveal] = useState(false);
  const previousStageRef = useRef(evolutionStage);
  const imageSrc = failedStageIds.includes(evolutionStage.id)
    ? "/character.png"
    : evolutionStage.image;

  useEffect(() => {
    const previousStage = previousStageRef.current;

    if (evolutionStage.id !== previousStage.id && evolutionStage.min > previousStage.min) {
      setShowStageReveal(true);
      const timer = window.setTimeout(() => setShowStageReveal(false), 1800);
      previousStageRef.current = evolutionStage;
      return () => window.clearTimeout(timer);
    }

    previousStageRef.current = evolutionStage;
  }, [evolutionStage]);

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-fuchsia-200/20 bg-[linear-gradient(145deg,rgba(20,8,28,0.96),rgba(78,13,68,0.52),rgba(5,3,8,0.98))] p-4 shadow-[0_0_60px_rgba(236,72,153,0.18)] transition"
    >
      <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative">
        <div className="relative min-h-[460px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
          <Image
            alt="Principessa, a stylish SFW anime mistress character placeholder"
            className="object-cover object-top"
            fill
            onError={() => {
              if (!failedStageIds.includes(evolutionStage.id)) {
                setFailedStageIds((current) => [...current, evolutionStage.id]);
              }
            }}
            unoptimized
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            src={imageSrc}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <div className="absolute right-4 top-4 rounded-full border border-pink-200/25 bg-black/55 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-pink-50 backdrop-blur">
            {evolutionStage.label}
          </div>
          {showStageReveal && (
            <div
              className="pointer-events-none absolute inset-0 opacity-0 [animation:character-stage-reveal_1800ms_ease-out_forwards]"
              key={evolutionStage.id}
            >
              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.18),rgba(236,72,153,0.1),transparent_62%)]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-100/35 bg-black/45 px-5 py-2 text-sm font-black uppercase tracking-[0.26em] text-yellow-50 shadow-[0_0_34px_rgba(250,204,21,0.32)] backdrop-blur">
                Stage Up
              </div>
            </div>
          )}
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
            Earn it slowly like a good boy, choose carefully, and bleed your fantasy coins to raise my affection or unlock my NSFW/SFW 				gallery cards. Don’t keep me waiting.
          </p>
        </div>
      </div>
    </section>
  );
}
