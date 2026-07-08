"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoinAmount } from "@/components/CoinAmount";
import type { PuzzleDifficulty, PuzzleImagePoolItem, PuzzlePreset } from "@/lib/puzzle";
import type { Profile } from "@/lib/supabase/client";

type PuzzleCompletion = {
  assisted_completed?: boolean;
  best_move_count?: number | null;
  best_solve_seconds?: number | null;
  completed_count?: number | null;
  difficulty: PuzzleDifficulty;
  source_image_id: string;
  source_type: string;
  unassisted_completed?: boolean;
};

type PuzzleAttempt = {
  coin_cost: number;
  difficulty: PuzzleDifficulty;
  grid_cols: number;
  grid_rows: number;
  id: string;
  piece_count: number;
  shuffle_seed: string;
};

type PuzzleResponse = {
  completions?: PuzzleCompletion[];
  images?: PuzzleImagePoolItem[];
  presets?: {
    standard: PuzzlePreset[];
    vertical: PuzzlePreset[];
  };
};

type PuzzleGameProps = {
  coins: number;
  disabled?: boolean;
  onProfileUpdate?: (profile: Profile) => void;
};

function seededShuffle(length: number, seed: string) {
  const values = Array.from({ length }, (_, index) => index);
  let state = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 2166136261);

  for (let index = values.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  if (values.every((value, index) => value === index) && values.length > 1) {
    [values[0], values[1]] = [values[1], values[0]];
  }

  return values;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function PuzzleGame({ coins, disabled = false, onProfileUpdate }: PuzzleGameProps) {
  const [images, setImages] = useState<PuzzleImagePoolItem[]>([]);
  const [completions, setCompletions] = useState<PuzzleCompletion[]>([]);
  const [presets, setPresets] = useState<PuzzleResponse["presets"] | null>(null);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<PuzzleDifficulty>("glimpse");
  const [aspect, setAspect] = useState<"standard" | "vertical">("standard");
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [board, setBoard] = useState<number[]>([]);
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? images[0] ?? null;
  const activePresets = presets?.[aspect] ?? [];
  const selectedPreset = activePresets.find((preset) => preset.difficulty === selectedDifficulty) ?? activePresets[0] ?? null;

  const loadPuzzleData = async () => {
    try {
      const response = await fetch("/api/user/puzzle", { cache: "no-store" });
      const payload = (await response.json()) as PuzzleResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Puzzle data could not be loaded.");
      }

      setImages(payload.images ?? []);
      setCompletions(payload.completions ?? []);
      setPresets(payload.presets ?? null);
      setSelectedImageId((current) => current || payload.images?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Puzzle data could not be loaded.");
    }
  };

  useEffect(() => {
    void loadPuzzleData();
  }, []);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attempt]);

  const completionMap = useMemo(() => {
    const map = new Map<string, PuzzleCompletion>();
    completions.forEach((completion) => {
      map.set(`${completion.source_type}:${completion.source_image_id}:${completion.difficulty}`, completion);
    });
    return map;
  }, [completions]);

  const startPuzzle = async () => {
    if (!selectedImage || !selectedPreset || isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({
          action: "start",
          aspect,
          difficulty: selectedPreset.difficulty,
          sourceImageId: selectedImage.id,
          sourceType: selectedImage.sourceType,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        attempt?: PuzzleAttempt;
        error?: string;
        profile?: Profile;
      };

      if (!response.ok || !payload.attempt) {
        throw new Error(payload.error ?? "Puzzle could not start.");
      }

      setAttempt(payload.attempt);
      setBoard(seededShuffle(payload.attempt.piece_count, payload.attempt.shuffle_seed));
      setMoves(0);
      setSeconds(0);
      setSelectedPieceIndex(null);
      setCompletedAttemptId(null);
      startedAtRef.current = Date.now();

      if (payload.profile) {
        onProfileUpdate?.(payload.profile);
      }
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Puzzle could not start.");
    } finally {
      setIsBusy(false);
    }
  };

  const completePuzzle = async (nextBoard: number[], nextMoves: number) => {
    if (!attempt || completedAttemptId === attempt.id) {
      return;
    }

    setCompletedAttemptId(attempt.id);

    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({
          action: "complete",
          attemptId: attempt.id,
          finalBoard: nextBoard,
          moveCount: nextMoves,
          solveSeconds: Math.max(1, seconds),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Puzzle completion could not be saved.");
      }

      await loadPuzzleData();
    } catch (completeError) {
      setCompletedAttemptId(null);
      setError(completeError instanceof Error ? completeError.message : "Puzzle completion could not be saved.");
    }
  };

  const selectPiece = (index: number) => {
    if (!attempt) {
      return;
    }

    if (selectedPieceIndex === null) {
      setSelectedPieceIndex(index);
      return;
    }

    if (selectedPieceIndex === index) {
      setSelectedPieceIndex(null);
      return;
    }

    setBoard((current) => {
      const next = [...current];
      [next[selectedPieceIndex], next[index]] = [next[index], next[selectedPieceIndex]];
      const nextMoves = moves + 1;
      setMoves(nextMoves);

      if (next.every((value, pieceIndex) => value === pieceIndex)) {
        void completePuzzle(next, nextMoves);
      }

      return next;
    });
    setSelectedPieceIndex(null);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-[1.5rem] border border-sky-200/15 bg-[linear-gradient(145deg,rgba(5,18,28,0.92),rgba(12,48,58,0.58),rgba(0,0,0,0.7))] p-4 shadow-[0_0_44px_rgba(14,165,233,0.12)] sm:rounded-[2rem] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-100/70">Puzzle</p>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Puzzle Trial</h2>
          </div>
          <p className="text-sm text-sky-50/72">Balance: <CoinAmount amount={coins} className="font-black text-white" iconSize={16} label="" /></p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.length === 0 ? (
              <div className="col-span-full rounded-[1.25rem] border border-sky-200/15 bg-black/35 px-4 py-8 text-center">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-100/65">
                  Puzzle pool is empty
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Add images to public/puzzle and they will appear here.
                </p>
              </div>
            ) : images.map((image) => (
              <button
                className={`overflow-hidden rounded-[1rem] border bg-black/35 text-left transition ${
                  selectedImage?.id === image.id
                    ? "border-sky-200/55 shadow-[0_0_24px_rgba(125,211,252,0.22)]"
                    : "border-white/10 hover:border-sky-200/35"
                }`}
                key={`${image.sourceType}:${image.id}`}
                onClick={() => setSelectedImageId(image.id)}
                type="button"
              >
                <div className="relative aspect-[4/5]">
                  <Image alt={image.title} className="object-cover" fill sizes="240px" src={image.image} unoptimized />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-black text-white">{image.title}</p>
                  <p className="mt-1 text-xs text-sky-100/60">{image.tag}</p>
                </div>
              </button>
            ))}
          </div>

          <aside className="rounded-[1.25rem] border border-white/10 bg-black/35 p-4">
            {selectedImage ? (
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] border border-white/10">
                <Image
                  alt={selectedImage.title}
                  className="object-cover"
                  fill
                  onLoadingComplete={(image) => {
                    setAspect(image.naturalHeight / Math.max(1, image.naturalWidth) >= 1.25 ? "vertical" : "standard");
                  }}
                  sizes="340px"
                  src={selectedImage.image}
                  unoptimized
                />
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              {activePresets.map((preset) => {
                const completion = selectedImage
                  ? completionMap.get(`${selectedImage.sourceType}:${selectedImage.id}:${preset.difficulty}`)
                  : null;

                return (
                  <button
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      selectedDifficulty === preset.difficulty
                        ? "border-sky-200/55 bg-sky-300/12"
                        : "border-white/10 bg-white/[0.04] hover:border-sky-200/30"
                    }`}
                    key={preset.difficulty}
                    onClick={() => setSelectedDifficulty(preset.difficulty)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white">{preset.label}</span>
                      <CoinAmount amount={preset.coinCost} className="text-xs font-bold text-sky-50" iconSize={14} label="" />
                    </div>
                    <p className="mt-1 text-xs text-sky-100/60">
                      {preset.cols}x{preset.rows} / {preset.cols * preset.rows} pieces
                      {completion ? " / completed" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              className="mt-4 w-full rounded-2xl bg-sky-300 px-4 py-3 text-sm font-black text-black transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || isBusy || !selectedImage || !selectedPreset || coins < (selectedPreset?.coinCost ?? 0)}
              onClick={() => void startPuzzle()}
              type="button"
            >
              Start Puzzle
            </button>
          </aside>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}
      </div>

      {attempt && selectedImage ? (
        <section className="rounded-[1.5rem] border border-white/10 bg-black/55 p-3 sm:rounded-[2rem] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-100/60">{selectedImage.title}</p>
              <h3 className="mt-1 text-xl font-black text-white">{attempt.grid_cols}x{attempt.grid_rows} Trial</h3>
            </div>
            <div className="flex gap-2 text-xs font-black uppercase tracking-[0.14em] text-sky-50">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{formatTimer(seconds)}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{moves} moves</span>
            </div>
          </div>

          <div
            className="mt-4 grid overflow-hidden rounded-[1rem] border border-white/10 bg-black/70"
            style={{
              aspectRatio: `${attempt.grid_cols} / ${attempt.grid_rows}`,
              gridTemplateColumns: `repeat(${attempt.grid_cols}, minmax(0, 1fr))`,
            }}
          >
            {board.map((piece, index) => {
              const correctCol = piece % attempt.grid_cols;
              const correctRow = Math.floor(piece / attempt.grid_cols);
              const selected = selectedPieceIndex === index;

              return (
                <button
                  aria-label={`Puzzle piece ${index + 1}`}
                  className={`aspect-square border border-black/35 bg-cover bg-no-repeat outline-none ${
                    selected ? "z-10 ring-2 ring-sky-200" : ""
                  }`}
                  key={`${attempt.id}:${index}`}
                  onClick={() => selectPiece(index)}
                  style={{
                    backgroundImage: `url(${selectedImage.image})`,
                    backgroundPosition: `${attempt.grid_cols === 1 ? 0 : (correctCol / (attempt.grid_cols - 1)) * 100}% ${attempt.grid_rows === 1 ? 0 : (correctRow / (attempt.grid_rows - 1)) * 100}%`,
                    backgroundSize: `${attempt.grid_cols * 100}% ${attempt.grid_rows * 100}%`,
                  }}
                  type="button"
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
