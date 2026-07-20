"use client";

import Image from "next/image";
import { memo, type MutableRefObject, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  hint_count?: number | null;
  id: string;
  move_count?: number | null;
  piece_count: number;
  progress_state?: PuzzleProgressState | null;
  shuffle_seed: string;
  source_image_id?: string;
  source_type?: string;
};

type PuzzleResponse = {
  activeAttempt?: PuzzleAttempt | null;
  activeImage?: PuzzleImagePoolItem | null;
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

type PuzzlePieceState = {
  col: number;
  correctX: number;
  correctY: number;
  currentX: number;
  currentY: number;
  height: number;
  id: number;
  placed: boolean;
  row: number;
  width: number;
};

type PuzzleLayout = {
  boardHeight: number;
  boardWidth: number;
  boardX: number;
  boardY: number;
  compact: boolean;
  stageHeight: number;
  stageWidth: number;
  trayPieceSize: number;
  trayY: number;
};

type DragState = {
  id: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

type PuzzlePieceProgress = {
  id: number;
  placed: boolean;
  x: number;
  y: number;
};

type PuzzleProgressState = {
  moves: number;
  pieces: PuzzlePieceProgress[];
  stageHeight: number;
  stageWidth: number;
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
  imageUrl,
  initialMoveCount,
  initialProgress,
  onComplete,
  onMove,
  onProgressSave,
  hintRequestId,
}: {
  attempt: PuzzleAttempt;
  imageUrl: string;
  initialMoveCount: number;
  initialProgress: PuzzleProgressState | null;
  onComplete: (moves: number) => void;
  onMove: (moves: number) => void;
  onProgressSave: (progressState: PuzzleProgressState, moves: number) => void;
  hintRequestId: number;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<PuzzleLayout | null>(null);
  const [pieces, setPieces] = useState<PuzzlePieceState[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [snapPieceId, setSnapPieceId] = useState<number | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const completedRef = useRef(false);
  const handledHintRequestRef = useRef(0);
  const initializedAttemptIdRef = useRef<typeof attempt.id | null>(null);

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

  const calculateLayout = useCallback((containerWidth: number): PuzzleLayout => {
    const compact = containerWidth < 720;

    if (compact) {
      const stageWidth = Math.max(320, Math.floor(containerWidth));
      const boardWidth = Math.max(300, Math.min(stageWidth - 24, 520));
      const boardHeight = Math.round(boardWidth * (attempt.grid_rows / attempt.grid_cols));
      const boardX = Math.round((stageWidth - boardWidth) / 2);
      const boardY = 56;
      const trayPieceSize = attempt.grid_cols >= 20 ? 34 : attempt.grid_cols >= 15 ? 38 : 42;
      const trayGap = 8;
      const trayColumns = Math.max(1, Math.floor((stageWidth - 24) / (trayPieceSize + trayGap)));
      const trayRows = Math.ceil(attempt.piece_count / trayColumns);
      const trayY = boardY + boardHeight + 30;
      const stageHeight = trayY + trayRows * (trayPieceSize + trayGap) + 22;

      return { boardHeight, boardWidth, boardX, boardY, compact, stageHeight, stageWidth, trayPieceSize, trayY };
    }

    const minimumStageWidth = attempt.grid_cols >= 25 ? 1540 : attempt.grid_cols >= 20 ? 1360 : attempt.grid_cols >= 15 ? 1180 : 980;
    const stageWidth = Math.max(minimumStageWidth, Math.floor(containerWidth));
    const boardMaxWidth = Math.min(attempt.grid_cols >= 20 ? 980 : 760, Math.floor(stageWidth * 0.62));
    const boardMinWidth = attempt.grid_cols >= 25 ? 900 : attempt.grid_cols >= 20 ? 820 : attempt.grid_cols >= 15 ? 700 : 620;
    const boardWidth = Math.max(boardMinWidth, boardMaxWidth);
    const boardHeight = Math.round(boardWidth * (attempt.grid_rows / attempt.grid_cols));
    const boardX = Math.round((stageWidth - boardWidth) / 2);
    const boardY = 64;
    const stageHeight = Math.max(560, boardY + boardHeight + 72);

    return { boardHeight, boardWidth, boardX, boardY, compact, stageHeight, stageWidth, trayPieceSize: 0, trayY: 0 };
  }, [attempt.grid_cols, attempt.grid_rows]);

  const buildPieces = useCallback((nextLayout: PuzzleLayout) => {
    const pieceWidth = nextLayout.boardWidth / attempt.grid_cols;
    const pieceHeight = nextLayout.boardHeight / attempt.grid_rows;
    const shuffled = seededShuffle(attempt.piece_count, attempt.shuffle_seed);
    const compactTrayGap = 8;
    const compactTrayColumns = nextLayout.compact
      ? Math.max(1, Math.floor((nextLayout.stageWidth - 24) / (nextLayout.trayPieceSize + compactTrayGap)))
      : 0;
    const leftTrayX = 28;
    const rightTrayX = nextLayout.boardX + nextLayout.boardWidth + 28;
    const trayWidth = Math.max(120, nextLayout.boardX - 52);
    const usableHeight = nextLayout.stageHeight - pieceHeight - 56;

    return shuffled.map((pieceId, trayIndex) => {
      const row = Math.floor(pieceId / attempt.grid_cols);
      const col = pieceId % attempt.grid_cols;
      const compactTrayX = 12 + (trayIndex % Math.max(1, compactTrayColumns)) * (nextLayout.trayPieceSize + compactTrayGap);
      const compactTrayY = nextLayout.trayY + Math.floor(trayIndex / Math.max(1, compactTrayColumns)) * (nextLayout.trayPieceSize + compactTrayGap);
      const side = trayIndex % 2 === 0 ? "left" : "right";
      const sideIndex = Math.floor(trayIndex / 2);
      const lane = sideIndex % Math.max(1, attempt.grid_rows);
      const stack = Math.floor(sideIndex / Math.max(1, attempt.grid_rows));
      const drift = ((pieceId * 37 + sideIndex * 19) % 54) - 27;
      const trayX = side === "left"
        ? leftTrayX + ((pieceId * 23) % Math.max(1, trayWidth - pieceWidth))
        : rightTrayX + ((pieceId * 29) % Math.max(1, trayWidth - pieceWidth));
      const trayY = 34 + ((lane * (pieceHeight * 0.82 + 22) + stack * 17 + drift) % Math.max(1, usableHeight));

      return {
        col,
        correctX: nextLayout.boardX + col * pieceWidth,
        correctY: nextLayout.boardY + row * pieceHeight,
        currentX: nextLayout.compact ? compactTrayX : trayX,
        currentY: nextLayout.compact ? compactTrayY : trayY,
        height: pieceHeight,
        id: pieceId,
        placed: false,
        row,
        width: pieceWidth,
      };
    });
  }, [attempt.grid_cols, attempt.grid_rows, attempt.piece_count, attempt.shuffle_seed]);

  const applyProgress = useCallback((nextPieces: PuzzlePieceState[], nextLayout: PuzzleLayout) => {
    if (!initialProgress || initialProgress.pieces.length === 0) {
      return nextPieces;
    }

    const progressById = new Map(initialProgress.pieces.map((piece) => [piece.id, piece]));

    return nextPieces.map((piece) => {
      const progress = progressById.get(piece.id);
      if (!progress) {
        return piece;
      }

      if (progress.placed) {
        return {
          ...piece,
          currentX: piece.correctX,
          currentY: piece.correctY,
          placed: true,
        };
      }

      return {
        ...piece,
        currentX: Math.max(0, Math.min(nextLayout.stageWidth - piece.width, progress.x * nextLayout.stageWidth)),
        currentY: Math.max(0, Math.min(nextLayout.stageHeight - piece.height, progress.y * nextLayout.stageHeight)),
      };
    });
  }, [initialProgress]);

  const createProgressState = useCallback((nextPieces: PuzzlePieceState[], nextMoves: number, nextLayout: PuzzleLayout): PuzzleProgressState => ({
    moves: nextMoves,
    pieces: nextPieces.map((piece) => ({
      id: piece.id,
      placed: piece.placed,
      x: piece.currentX / nextLayout.stageWidth,
      y: piece.currentY / nextLayout.stageHeight,
    })),
    stageHeight: nextLayout.stageHeight,
    stageWidth: nextLayout.stageWidth,
  }), []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const syncLayout = () => {
      const nextLayout = calculateLayout(element.parentElement?.clientWidth ?? element.clientWidth);
      setLayout(nextLayout);
      setPieces((currentPieces) => {
        if (currentPieces.length === 0) {
          return applyProgress(buildPieces(nextLayout), nextLayout);
        }

        if (currentPieces.some((piece) => piece.placed)) {
          return buildPieces(nextLayout).map((piece) => {
            const existing = currentPieces.find((currentPiece) => currentPiece.id === piece.id);
            return existing?.placed
              ? { ...piece, currentX: piece.correctX, currentY: piece.correctY, placed: true }
              : piece;
          });
        }

        return buildPieces(nextLayout);
      });
    };

    syncLayout();
    const observer = new ResizeObserver(syncLayout);
    observer.observe(element.parentElement ?? element);

    return () => observer.disconnect();
  }, [applyProgress, buildPieces, calculateLayout]);

  useEffect(() => {
    // Only (re)initialize when a genuinely new attempt loads. This effect used
    // to depend on initialMoveCount, which this component itself bumps on every
    // placement via onMove -> parent setMoves -> new initialMoveCount prop -
    // causing a full reset (discarding placed pieces, including hint placements)
    // after every single move.
    if (initializedAttemptIdRef.current === attempt.id) {
      return;
    }
    initializedAttemptIdRef.current = attempt.id;

    completedRef.current = false;
    setMoveCount(initialMoveCount);
    onMove(initialMoveCount);
    setDrag(null);
    setSelectedPieceId(null);
    setSnapPieceId(null);
    setIsSolved(false);
    setPieces(layout ? applyProgress(buildPieces(layout), layout) : []);
  }, [applyProgress, attempt.id, buildPieces, initialMoveCount, layout, onMove]);

  const placedCount = pieces.filter((piece) => piece.placed).length;

  useEffect(() => {
    if (!hintRequestId || hintRequestId === handledHintRequestRef.current || !layout) return;
    handledHintRequestRef.current = hintRequestId;

    setPieces((currentPieces) => {
      const unplacedPieces = currentPieces.filter((piece) => !piece.placed);
      const piece = unplacedPieces[hintRequestId % Math.max(1, unplacedPieces.length)];
      if (!piece) return currentPieces;

      const nextPieces = currentPieces.map((currentPiece) => (
        currentPiece.id === piece.id
          ? { ...currentPiece, currentX: currentPiece.correctX, currentY: currentPiece.correctY, placed: true }
          : currentPiece
      ));
      setSnapPieceId(piece.id);
      window.setTimeout(() => setSnapPieceId((current) => (current === piece.id ? null : current)), 360);

      if (!completedRef.current && nextPieces.every((nextPiece) => nextPiece.placed)) {
        completedRef.current = true;
        setIsSolved(true);
        onComplete(moveCount);
      } else {
        onProgressSave(createProgressState(nextPieces, moveCount, layout), moveCount);
      }

      return nextPieces;
    });
  }, [createProgressState, hintRequestId, layout, moveCount, onComplete, onProgressSave]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, piece: PuzzlePieceState) => {
    if (piece.placed || layout?.compact) {
      return;
    }

    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: piece.id,
      offsetX: event.clientX - stageRect.left - piece.currentX,
      offsetY: event.clientY - stageRect.top - piece.currentY,
      pointerId: event.pointerId,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag || layout?.compact) {
      return;
    }

    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }

    const nextX = event.clientX - stageRect.left - drag.offsetX;
    const nextY = event.clientY - stageRect.top - drag.offsetY;
    setPieces((currentPieces) => currentPieces.map((piece) => (
      piece.id === drag.id ? { ...piece, currentX: nextX, currentY: nextY } : piece
    )));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>, piece: PuzzlePieceState) => {
    if (!drag || drag.id !== piece.id || layout?.compact) {
      return;
    }

    event.currentTarget.releasePointerCapture(drag.pointerId);
    setDrag(null);
    const nextMoveCount = moveCount + 1;
    setMoveCount(nextMoveCount);
    onMove(nextMoveCount);

    setPieces((currentPieces) => {
      const snapDistance = Math.max(24, Math.min(40, piece.width * 0.34));
      let snapped = false;
      const nextPieces = currentPieces.map((currentPiece) => {
        if (currentPiece.id !== piece.id || currentPiece.placed) {
          return currentPiece;
        }

        const distance = Math.hypot(currentPiece.currentX - currentPiece.correctX, currentPiece.currentY - currentPiece.correctY);
        if (distance <= snapDistance) {
          snapped = true;
          return {
            ...currentPiece,
            currentX: currentPiece.correctX,
            currentY: currentPiece.correctY,
            placed: true,
          };
        }

        return currentPiece;
      });

      if (snapped) {
        setSnapPieceId(piece.id);
        window.setTimeout(() => setSnapPieceId((current) => (current === piece.id ? null : current)), 360);
      }

      if (!completedRef.current && nextPieces.every((nextPiece) => nextPiece.placed)) {
        completedRef.current = true;
        setIsSolved(true);
        onComplete(nextMoveCount);
      } else if (layout) {
        onProgressSave(createProgressState(nextPieces, nextMoveCount, layout), nextMoveCount);
      }

      return nextPieces;
    });
  };

  const settleMobileMove = (pieceId: number, targetRow: number, targetCol: number) => {
    if (!layout?.compact) {
      return;
    }

    const piece = pieces.find((currentPiece) => currentPiece.id === pieceId);
    if (!piece || piece.placed) {
      return;
    }

    if (piece.row !== targetRow || piece.col !== targetCol) {
      setSelectedPieceId(pieceId);
      return;
    }

    const nextMoveCount = moveCount + 1;
    setMoveCount(nextMoveCount);
    onMove(nextMoveCount);
    setSelectedPieceId(null);

    setPieces((currentPieces) => {
      const nextPieces = currentPieces.map((currentPiece) => (
        currentPiece.id === pieceId
          ? { ...currentPiece, currentX: currentPiece.correctX, currentY: currentPiece.correctY, placed: true }
          : currentPiece
      ));

      setSnapPieceId(pieceId);
      window.setTimeout(() => setSnapPieceId((current) => (current === pieceId ? null : current)), 360);

      if (!completedRef.current && nextPieces.every((nextPiece) => nextPiece.placed)) {
        completedRef.current = true;
        setIsSolved(true);
        onComplete(nextMoveCount);
      } else {
        onProgressSave(createProgressState(nextPieces, nextMoveCount, layout), nextMoveCount);
      }

      return nextPieces;
    });
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-[1rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.08),transparent_32%),linear-gradient(135deg,rgba(18,18,24,0.98),rgba(4,8,13,0.98))] p-2 shadow-inner shadow-black/70 sm:p-3">
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
        className="relative mx-auto overflow-hidden rounded-[1.25rem] border border-sky-100/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.04),transparent_18%,transparent_82%,rgba(255,255,255,0.04)),radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.10),transparent_34%)]"
        ref={stageRef}
        style={{
          height: layout?.stageHeight ?? 560,
          minWidth: layout?.compact ? 0 : 980,
          width: layout?.stageWidth ?? "100%",
        }}
      >
        {layout ? (
          <>
            {!layout.compact ? (
              <>
                <div className="absolute inset-y-8 left-5 w-[13%] rounded-2xl border border-white/10 bg-black/25 shadow-inner shadow-black/60" />
                <div className="absolute inset-y-8 right-5 w-[13%] rounded-2xl border border-white/10 bg-black/25 shadow-inner shadow-black/60" />
              </>
            ) : (
              <div
                className="absolute rounded-2xl border border-white/10 bg-black/28 shadow-inner shadow-black/60"
                style={{
                  height: Math.max(120, layout.stageHeight - layout.trayY - 12),
                  left: 8,
                  top: layout.trayY - 8,
                  width: layout.stageWidth - 16,
                }}
              />
            )}
            <div
              className="absolute rounded-[1rem] border border-sky-100/25 bg-black/45 shadow-[0_0_34px_rgba(125,211,252,0.14),inset_0_0_48px_rgba(0,0,0,0.72)]"
              style={{
                height: layout.boardHeight,
                left: layout.boardX,
                top: layout.boardY,
                width: layout.boardWidth,
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.16]"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.34) 1px, transparent 1px)`,
                  backgroundSize: `${layout.boardWidth / attempt.grid_cols}px ${layout.boardHeight / attempt.grid_rows}px`,
                }}
              />
              <div className="absolute inset-0 rounded-[1rem] ring-1 ring-inset ring-white/10" />
            </div>
            {layout.compact && selectedPieceId !== null ? (
              <div
                className="absolute rounded-[1rem] ring-2 ring-sky-200/45"
                style={{
                  height: layout.boardHeight,
                  left: layout.boardX,
                  top: layout.boardY,
                  width: layout.boardWidth,
                  zIndex: 16,
                }}
              >
                {Array.from({ length: attempt.piece_count }, (_, index) => {
                  const row = Math.floor(index / attempt.grid_cols);
                  const col = index % attempt.grid_cols;
                  const cellWidth = layout.boardWidth / attempt.grid_cols;
                  const cellHeight = layout.boardHeight / attempt.grid_rows;

                  return (
                    <button
                      aria-label={`Place selected piece at row ${row + 1}, column ${col + 1}`}
                      className="absolute rounded-[2px] border border-white/0 bg-sky-200/0 transition hover:bg-sky-200/18 active:bg-sky-100/24"
                      key={`mobile-target-${index}`}
                      onClick={() => settleMobileMove(selectedPieceId, row, col)}
                      style={{
                        height: cellHeight,
                        left: col * cellWidth,
                        top: row * cellHeight,
                        width: cellWidth,
                      }}
                      type="button"
                    />
                  );
                })}
              </div>
            ) : null}
            {isSolved ? (
              <div
                className="absolute rounded-[1rem] border border-sky-100/55 bg-cover bg-center bg-no-repeat shadow-[0_0_44px_rgba(125,211,252,0.36)] animate-[pulse_0.72s_ease-out_1]"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "100% 100%",
                  height: layout.boardHeight,
                  left: layout.boardX,
                  top: layout.boardY,
                  width: layout.boardWidth,
                  zIndex: 60,
                }}
              >
                <div className="absolute inset-0 rounded-[1rem] ring-2 ring-inset ring-white/35" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-black/45 bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white">
                  Completed
                </div>
              </div>
            ) : null}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-sky-100/15 bg-black/45 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-sky-50/75">
              Assembly Board / {placedCount}/{attempt.piece_count} placed
            </div>
            {layout.compact ? (
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.18em] text-sky-50/65"
                style={{ top: layout.trayY - 32 }}
              >
                Tap a piece, then tap its place
              </div>
            ) : null}
            {pieces.map((piece) => {
              const shapeKey = getJigsawShapeKey(getJigsawEdges(piece.id, attempt.grid_cols, attempt.grid_rows)).replaceAll(":", "-");
              const isDragging = drag?.id === piece.id;
              const isSnapping = snapPieceId === piece.id;
              const isSelected = selectedPieceId === piece.id;
              const renderWidth = layout.compact && !piece.placed ? layout.trayPieceSize : piece.width;
              const renderHeight = layout.compact && !piece.placed ? layout.trayPieceSize : piece.height;
              const renderBackgroundWidth = layout.compact && !piece.placed ? layout.trayPieceSize * attempt.grid_cols : layout.boardWidth;
              const renderBackgroundHeight = layout.compact && !piece.placed ? layout.trayPieceSize * attempt.grid_rows : layout.boardHeight;

              return (
                <button
                  aria-label={`Puzzle piece ${piece.row + 1}-${piece.col + 1}`}
                  className={`absolute touch-none bg-no-repeat outline-none transition-[filter,transform,box-shadow] duration-150 ${
                    piece.placed
                      ? "cursor-default drop-shadow-[0_0_10px_rgba(125,211,252,0.34)]"
                      : layout.compact
                        ? "cursor-pointer rounded-md border border-white/10 hover:z-30 hover:scale-[1.08] hover:drop-shadow-[0_0_18px_rgba(125,211,252,0.66)]"
                        : "cursor-grab hover:z-30 hover:scale-[1.055] hover:drop-shadow-[0_0_18px_rgba(125,211,252,0.66)] active:cursor-grabbing"
                  } ${isDragging ? "z-40 scale-[1.08] brightness-110 drop-shadow-[0_0_24px_rgba(125,211,252,0.78)]" : ""} ${
                    isSnapping ? "animate-[pulse_0.36s_ease-out_1] brightness-125" : ""
                  } ${
                    isSelected ? "z-50 scale-[1.14] border-sky-100/70 brightness-125 drop-shadow-[0_0_24px_rgba(125,211,252,0.82)]" : ""
                  }`}
                  key={`${attempt.id}:${piece.id}`}
                  onClick={() => {
                    if (layout.compact && !piece.placed) {
                      setSelectedPieceId((current) => (current === piece.id ? null : piece.id));
                    }
                  }}
                  onPointerDown={(event) => handlePointerDown(event, piece)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => handlePointerUp(event, piece)}
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundPosition: `-${piece.col * renderWidth}px -${piece.row * renderHeight}px`,
                    backgroundSize: `${renderBackgroundWidth}px ${renderBackgroundHeight}px`,
                    clipPath: `url(#jigsaw-${shapeKey})`,
                    height: renderHeight,
                    left: piece.currentX,
                    top: piece.currentY,
                    width: renderWidth,
                    zIndex: piece.placed ? 8 : isSelected ? 50 : isDragging ? 40 : 18 + (piece.id % 7),
                  }}
                  type="button"
                />
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
});

const PUZZLE_HINT_COIN_COST = 500;

function getFreeHintCount(pieceCount: number) {
  if (pieceCount <= 150) return 1;
  if (pieceCount <= 300) return 2;
  return 3;
}

export function PuzzleGame({ coins, disabled = false, onProfileUpdate }: PuzzleGameProps) {
  const [images, setImages] = useState<PuzzleImagePoolItem[]>([]);
  const [activeImage, setActiveImage] = useState<PuzzleImagePoolItem | null>(null);
  const [completions, setCompletions] = useState<PuzzleCompletion[]>([]);
  const [presets, setPresets] = useState<PuzzleResponse["presets"] | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<PuzzleDifficulty>("glimpse");
  const [aspect, setAspect] = useState<"standard" | "vertical">("standard");
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [moves, setMoves] = useState(0);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isHintBusy, setIsHintBusy] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [hintRequestId, setHintRequestId] = useState(0);
  const [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null);
  const [dailyKey, setDailyKey] = useState("");
  const [nextDailyResetAt, setNextDailyResetAt] = useState<string | null>(null);
  const [poolCount, setPoolCount] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const selectedImage = activeImage ?? images[0] ?? null;
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
      setActiveImage(payload.activeImage ?? null);
      setCompletions(payload.completions ?? []);
      setDailyKey(payload.dailyKey ?? "");
      setNextDailyResetAt(payload.nextDailyResetAt ?? null);
      setPoolCount(payload.poolCount ?? payload.images?.length ?? 0);
      setPresets(payload.presets ?? null);
      if (payload.activeAttempt) {
        const restoredMoves = Number(payload.activeAttempt.progress_state?.moves ?? payload.activeAttempt.move_count ?? 0);
        setAttempt(payload.activeAttempt);
        setMoves(restoredMoves);
        setHintCount(Math.max(0, Number(payload.activeAttempt.hint_count ?? 0)));
        setCompletedAttemptId(null);
        startedAtRef.current = Date.now();
      }
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
      setActiveImage(selectedImage);
      setMoves(0);
      setCompletedAttemptId(null);
      setHintCount(0);
      setHintRequestId(0);
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

  const requestHint = async () => {
    if (!attempt || isHintBusy) {
      return;
    }

    setIsHintBusy(true);
    setError("");

    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({
          action: "hint",
          attemptId: attempt.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        hintNumber?: number;
        profile?: Profile;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Puzzle hint could not be used.");
      }

      setHintCount(Math.max(1, Number(payload.hintNumber ?? hintCount + 1)));
      setHintRequestId((current) => current + 1);

      if (payload.profile) {
        onProfileUpdate?.(payload.profile);
      }
    } catch (hintError) {
      setError(hintError instanceof Error ? hintError.message : "Puzzle hint could not be used.");
    } finally {
      setIsHintBusy(false);
    }
  };

  const abandonPuzzle = async () => {
    if (!attempt || isBusy || !window.confirm("Abandon this puzzle? Your entry coins will not be refunded.")) return;
    setIsBusy(true);
    setError("");
    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({ action: "abandon", attemptId: attempt.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Puzzle could not be abandoned.");
      setAttempt(null);
      setActiveImage(null);
      setHintCount(0);
      setHintRequestId(0);
      await loadPuzzleData();
    } catch (abandonError) {
      setError(abandonError instanceof Error ? abandonError.message : "Puzzle could not be abandoned.");
    } finally {
      setIsBusy(false);
    }
  };

  const savePuzzleProgress = async (progressState: PuzzleProgressState, nextMoves: number) => {
    if (!attempt || completedAttemptId === attempt.id) {
      return;
    }

    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({
          action: "save-progress",
          attemptId: attempt.id,
          moveCount: nextMoves,
          progressState,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Puzzle progress could not be saved.");
      }
    } catch (progressError) {
      setError(progressError instanceof Error ? progressError.message : "Puzzle progress could not be saved.");
    }
  };

  const completePuzzle = async (nextMoves: number) => {
    if (!attempt || completedAttemptId === attempt.id) {
      return;
    }

    setCompletedAttemptId(attempt.id);
    setMoves(nextMoves);

    try {
      const response = await fetch("/api/user/puzzle", {
        body: JSON.stringify({
          action: "complete",
          attemptId: attempt.id,
          finalBoard: Array.from({ length: attempt.piece_count }, (_, index) => index),
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

      setAttempt(null);
      setActiveImage(null);
      setHintCount(0);
      setHintRequestId(0);
      await loadPuzzleData();
    } catch (completeError) {
      setCompletedAttemptId(null);
      setError(completeError instanceof Error ? completeError.message : "Puzzle completion could not be saved.");
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="court-feature-panel rounded-[1.5rem] border border-sky-200/15 bg-[linear-gradient(145deg,rgba(5,18,28,0.92),rgba(12,48,58,0.58),rgba(0,0,0,0.7))] p-4 shadow-[0_0_44px_rgba(14,165,233,0.12)] sm:rounded-[2rem] sm:p-5">
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

        <div className="court-grid mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1.15fr)]">
          <div className="court-feature-card court-grid-card rounded-[1.25rem] border border-sky-200/15 bg-black/35 p-4">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-100/65">
              Today&apos;s image pool
            </p>
            <h3 className="mt-3 text-2xl font-black text-white">Assembly challenge</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              The image comes from the existing puzzle pool. Pick a piece count, pay the entry cost, then drag each loose piece onto the board.
            </p>
            <div
              className="relative mt-5 select-none overflow-hidden rounded-[1rem] border border-white/10 bg-black/55"
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
            >
              <div className="aspect-[4/3]">
                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.14),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.82))]">
                  <span className="px-5 text-center text-xs font-black uppercase tracking-[0.26em] text-sky-50/55">
                    Image hidden until puzzle starts
                  </span>
                </div>
              </div>
            </div>
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

          <aside className="court-feature-card court-grid-card rounded-[1.25rem] border border-white/10 bg-black/35 p-4">
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
                <div className="court-grid grid gap-2 sm:grid-cols-2">
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
                  disabled={disabled || isBusy || Boolean(attempt) || !selectedImage || !selectedPreset || coins < (selectedPreset?.coinCost ?? 0)}
                  onClick={() => void startPuzzle()}
                  type="button"
                >
                  {attempt ? "Puzzle Active" : "Start Puzzle"}
                </button>
              </>
            )}
          </aside>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}
      </div>

      {attempt && selectedImage ? (
      <section className="court-feature-panel rounded-[1.5rem] border border-white/10 bg-black/55 p-3 sm:rounded-[2rem] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-100/60">Daily hidden puzzle</p>
              <h3 className="mt-1 text-xl font-black text-white">{attempt.grid_cols}x{attempt.grid_rows} Puzzle Board</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-sky-50">
              <TimerBadge startedAtRef={startedAtRef} />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{moves} moves</span>
              <button
                className="rounded-full border border-sky-200/25 bg-sky-300/10 px-3 py-2 transition hover:border-sky-100/55 hover:bg-sky-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || isHintBusy || (hintCount >= getFreeHintCount(attempt.piece_count) && coins < PUZZLE_HINT_COIN_COST)}
                onClick={() => void requestHint()}
                type="button"
              >
                {hintCount < getFreeHintCount(attempt.piece_count)
                  ? `Place a Piece / Free (${getFreeHintCount(attempt.piece_count) - hintCount} left)`
                  : <><span>Place a Piece / </span><CoinAmount amount={PUZZLE_HINT_COIN_COST} className="font-black text-white" iconSize={13} label="" /></>}
              </button>
              <button
                className="rounded-full border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-rose-100 transition hover:border-rose-100/55 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || isBusy}
                onClick={() => void abandonPuzzle()}
                type="button"
              >
                Abandon / No refund
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-sky-50/60">
            Drag pieces from the side trays onto the assembly board. Pieces snap and lock when they are close enough to their true position.
          </p>

          <PuzzleBoard
            attempt={attempt}
            imageUrl={selectedImage.image}
            initialMoveCount={moves}
            initialProgress={attempt.progress_state ?? null}
            onComplete={(nextMoves) => void completePuzzle(nextMoves)}
            onMove={setMoves}
            onProgressSave={(progressState, nextMoves) => void savePuzzleProgress(progressState, nextMoves)}
            hintRequestId={hintRequestId}
          />
        </section>
      ) : null}
    </section>
  );
}
