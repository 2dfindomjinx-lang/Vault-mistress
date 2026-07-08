"use client";

import Image from "next/image";
import { memo, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
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
  dailyKey?: string;
  imageCount?: number;
  images?: PuzzleImagePoolItem[];
  nextDailyResetAt?: string;
  poolCount?: number;
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

type JigsawEdge = -1 | 0 | 1;

type JigsawEdges = {
  bottom: JigsawEdge;
  left: JigsawEdge;
  right: JigsawEdge;
  top: JigsawEdge;
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

function getJigsawEdges(piece: number, cols: number, rows: number): JigsawEdges {
  const col = piece % cols;
  const row = Math.floor(piece / cols);
  const right: JigsawEdge = col === cols - 1 ? 0 : (row + col) % 2 === 0 ? 1 : -1;
  const bottom: JigsawEdge = row === rows - 1 ? 0 : (row * 3 + col) % 2 === 0 ? -1 : 1;
  const left: JigsawEdge = col === 0 ? 0 : (row + col - 1) % 2 === 0 ? -1 : 1;
  const top: JigsawEdge = row === 0 ? 0 : ((row - 1) * 3 + col) % 2 === 0 ? 1 : -1;

  return { bottom, left, right, top };
}

function getJigsawShapeKey(edges: JigsawEdges) {
  return `${edges.top}:${edges.right}:${edges.bottom}:${edges.left}`;
}

function getJigsawPath(edges: JigsawEdges) {
  const topY = edges.top === 1 ? "0.01" : edges.top === -1 ? "0.17" : "0.08";
  const rightX = edges.right === 1 ? "0.99" : edges.right === -1 ? "0.83" : "0.92";
  const bottomY = edges.bottom === 1 ? "0.99" : edges.bottom === -1 ? "0.83" : "0.92";
  const leftX = edges.left === 1 ? "0.01" : edges.left === -1 ? "0.17" : "0.08";
  const top = edges.top === 0 ? "L 0.92 0.08" : `L 0.36 0.08 C 0.39 ${topY} 0.61 ${topY} 0.64 0.08 L 0.92 0.08`;
  const right = edges.right === 0 ? "L 0.92 0.92" : `L 0.92 0.36 C ${rightX} 0.39 ${rightX} 0.61 0.92 0.64 L 0.92 0.92`;
  const bottom = edges.bottom === 0 ? "L 0.08 0.92" : `L 0.64 0.92 C 0.61 ${bottomY} 0.39 ${bottomY} 0.36 0.92 L 0.08 0.92`;
  const left = edges.left === 0 ? "L 0.08 0.08" : `L 0.08 0.64 C ${leftX} 0.61 ${leftX} 0.39 0.08 0.36 L 0.08 0.08`;

  return `M 0.08 0.08 ${top} ${right} ${bottom} ${left} Z`;
}

function TimerBadge({ startedAtRef }: { startedAtRef: MutableRefObject<number | null> }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [startedAtRef]);

  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{formatTimer(seconds)}</span>;
}

const PuzzleBoard = memo(function PuzzleBoard({
  attempt,
  board,
  boardView,
  imageUrl,
  onSelectPiece,
  selectedPieceIndex,
}: {
  attempt: PuzzleAttempt;
  board: number[];
  boardView: "fit" | "detail";
  imageUrl: string;
  onSelectPiece: (index: number) => void;
  selectedPieceIndex: number | null;
}) {
  const jigsawShapes = useMemo(() => {
    const shapes = new Map<string, string>();

    for (let piece = 0; piece < attempt.piece_count; piece += 1) {
      const edges = getJigsawEdges(piece, attempt.grid_cols, attempt.grid_rows);
      const key = getJigsawShapeKey(edges);
      if (!shapes.has(key)) {
        shapes.set(key, getJigsawPath(edges));
      }
    }

    return Array.from(shapes.entries());
  }, [attempt.grid_cols, attempt.grid_rows, attempt.piece_count]);

  return (
    <div className="mt-4 overflow-auto rounded-[1rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_34%),linear-gradient(135deg,rgba(35,35,42,0.96),rgba(10,10,16,0.98))] p-4 shadow-inner shadow-black/60">
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          {jigsawShapes.map(([key, path]) => (
            <clipPath clipPathUnits="objectBoundingBox" id={`jigsaw-${key.replaceAll(":", "-")}`} key={key}>
              <path d={path} />
            </clipPath>
          ))}
        </defs>
      </svg>
      <div
        className="mx-auto grid"
        style={{
          aspectRatio: `${attempt.grid_cols} / ${attempt.grid_rows}`,
          gap: boardView === "detail" ? "6px" : "3px",
          gridTemplateColumns: `repeat(${attempt.grid_cols}, minmax(0, 1fr))`,
          minWidth: boardView === "detail" ? `${attempt.grid_cols * 58}px` : undefined,
          width: boardView === "fit" ? "100%" : "max-content",
        }}
      >
        {board.map((piece, index) => {
          const correctCol = piece % attempt.grid_cols;
          const correctRow = Math.floor(piece / attempt.grid_cols);
          const selected = selectedPieceIndex === index;
          const shapeKey = getJigsawShapeKey(getJigsawEdges(piece, attempt.grid_cols, attempt.grid_rows)).replaceAll(":", "-");

          return (
            <button
              aria-label={`Puzzle piece ${index + 1}`}
              className={`aspect-square bg-cover bg-no-repeat outline-none transition-[filter,transform] ${
                selected
                  ? "z-10 scale-[1.08] drop-shadow-[0_0_14px_rgba(125,211,252,0.72)] brightness-110"
                  : "hover:brightness-110"
              }`}
              key={`${attempt.id}:${index}`}
              onClick={() => onSelectPiece(index)}
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundPosition: `${attempt.grid_cols === 1 ? 0 : (correctCol / (attempt.grid_cols - 1)) * 100}% ${attempt.grid_rows === 1 ? 0 : (correctRow / (attempt.grid_rows - 1)) * 100}%`,
                backgroundSize: `${attempt.grid_cols * 100}% ${attempt.grid_rows * 100}%`,
                clipPath: `url(#jigsaw-${shapeKey})`,
              }}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
});

export function PuzzleGame({ coins, disabled = false, onProfileUpdate }: PuzzleGameProps) {
  const [images, setImages] = useState<PuzzleImagePoolItem[]>([]);
  const [completions, setCompletions] = useState<PuzzleCompletion[]>([]);
  const [presets, setPresets] = useState<PuzzleResponse["presets"] | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<PuzzleDifficulty>("glimpse");
  const [aspect, setAspect] = useState<"standard" | "vertical">("standard");
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [board, setBoard] = useState<number[]>([]);
  const [boardView, setBoardView] = useState<"fit" | "detail">("fit");
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null);
  const [dailyKey, setDailyKey] = useState("");
  const [nextDailyResetAt, setNextDailyResetAt] = useState<string | null>(null);
  const [poolCount, setPoolCount] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const selectedImage = images[0] ?? null;
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
      setDailyKey(payload.dailyKey ?? "");
      setNextDailyResetAt(payload.nextDailyResetAt ?? null);
      setPoolCount(payload.poolCount ?? payload.images?.length ?? 0);
      setPresets(payload.presets ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Puzzle data could not be loaded.");
    }
  };

  useEffect(() => {
    void loadPuzzleData();
  }, []);

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
          solveSeconds: Math.max(1, Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)),
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
            <h2 className="text-2xl font-black text-white sm:text-3xl">Puzzle</h2>
          </div>
          <div className="text-sm text-sky-50/72 sm:text-right">
            <p>Balance: <CoinAmount amount={coins} className="font-black text-white" iconSize={16} label="" /></p>
            <p className="mt-1 text-xs text-sky-100/55">
              Daily pool: {images.length}/{poolCount} images
              {nextDailyResetAt ? ` / resets ${new Date(nextDailyResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
        </div>

        {selectedImage ? (
          <Image
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px opacity-0"
            height={1}
            onLoadingComplete={(image) => {
              setAspect(image.naturalHeight / Math.max(1, image.naturalWidth) >= 1.25 ? "vertical" : "standard");
            }}
            src={selectedImage.image}
            unoptimized
            width={1}
          />
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1.15fr)]">
          <div className="rounded-[1.25rem] border border-sky-200/15 bg-black/35 p-4">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-100/65">
              Today&apos;s hidden puzzle
            </p>
            <h3 className="mt-3 text-2xl font-black text-white">One daily image, no preview</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Pool her gun tek gorsel secer. Baslamadan gorsel gosterilmez; sadece zorluk, parca sayisi ve coin bedeli gorunur.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-sky-50/70">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                Daily selection: <span className="font-black text-white">{images.length}/{poolCount}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                Daily key: <span className="font-black text-white">{dailyKey || "today"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                Aspect mode: <span className="font-black text-white">{aspect === "vertical" ? "Vertical" : "Standard"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                Reset: <span className="font-black text-white">
                  {nextDailyResetAt ? new Date(nextDailyResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "daily"}
                </span>
              </div>
            </div>
          </div>

          <aside className="rounded-[1.25rem] border border-white/10 bg-black/35 p-4">
            {images.length === 0 ? (
              <div className="rounded-[1.25rem] border border-sky-200/15 bg-black/35 px-4 py-8 text-center">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-100/65">
                  Puzzle pool is empty
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Add images to public/puzzle and the daily hidden selection will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
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
              </>
            )}
          </aside>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}
      </div>

      {attempt && selectedImage ? (
        <section className="rounded-[1.5rem] border border-white/10 bg-black/55 p-3 sm:rounded-[2rem] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-100/60">Daily hidden puzzle</p>
              <h3 className="mt-1 text-xl font-black text-white">{attempt.grid_cols}x{attempt.grid_rows} Puzzle Board</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-sky-50">
              <TimerBadge startedAtRef={startedAtRef} />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{moves} moves</span>
              <button
                className={`rounded-full border px-3 py-2 transition ${
                  boardView === "fit" ? "border-sky-200/55 bg-sky-300/15" : "border-white/10 bg-white/5 hover:border-sky-200/35"
                }`}
                onClick={() => setBoardView("fit")}
                type="button"
              >
                Fit
              </button>
              <button
                className={`rounded-full border px-3 py-2 transition ${
                  boardView === "detail" ? "border-sky-200/55 bg-sky-300/15" : "border-white/10 bg-white/5 hover:border-sky-200/35"
                }`}
                onClick={() => setBoardView("detail")}
                type="button"
              >
                Detail
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-sky-50/60">
            Fit tum board&apos;u sigdirir. Detail parcalari buyutur; buyuk puzzle&apos;larda alani kaydirarak oynarsin.
          </p>

          <PuzzleBoard
            attempt={attempt}
            board={board}
            boardView={boardView}
            imageUrl={selectedImage.image}
            onSelectPiece={selectPiece}
            selectedPieceIndex={selectedPieceIndex}
          />
        </section>
      ) : null}
    </section>
  );
}
