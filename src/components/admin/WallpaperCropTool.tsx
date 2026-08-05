"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import {
  WALLPAPER_MAX_ZOOM,
  WALLPAPER_MIN_ZOOM,
  WALLPAPER_TARGET_ASPECT_RATIO,
  clampWallpaperZoom,
  getWallpaperCoverLayout,
} from "@/lib/wallpaper-crop";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH / WALLPAPER_TARGET_ASPECT_RATIO);
const ZOOM_STEP = 0.25;

type WallpaperCropToolProps = {
  file: File;
  panX: number;
  panY: number;
  zoom: number;
  onPanChange: (panX: number, panY: number) => void;
  onZoomChange: (zoom: number) => void;
};

export function WallpaperCropTool({ file, panX, panY, zoom, onPanChange, onZoomChange }: WallpaperCropToolProps) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [trackedFile, setTrackedFile] = useState(file);
  const dragStateRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  // Reset the measured size when a new file is selected (adjusting state in
  // response to a prop change, done during render rather than in an effect).
  if (file !== trackedFile) {
    setTrackedFile(file);
    setNaturalSize(null);
  }

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const layout = naturalSize
    ? getWallpaperCoverLayout(naturalSize.width, naturalSize.height, PREVIEW_WIDTH, PREVIEW_HEIGHT, panX, panY, zoom)
    : null;
  const canDragX = Boolean(layout && layout.overflowX > 0);
  const canDragY = Boolean(layout && layout.overflowY > 0);

  const pinchDistance = () => {
    const [first, second] = Array.from(pointersRef.current.values());
    if (!first || !second) return 0;
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      dragStateRef.current = null;
      pinchStateRef.current = { startDistance: pinchDistance(), startZoom: zoom };
      return;
    }

    if (!layout || (!canDragX && !canDragY)) {
      return;
    }

    dragStateRef.current = { startX: event.clientX, startY: event.clientY, startPanX: panX, startPanY: panY };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const pinchState = pinchStateRef.current;
    if (pinchState && pointersRef.current.size === 2) {
      const distance = pinchDistance();
      if (pinchState.startDistance > 0 && distance > 0) {
        onZoomChange(clampWallpaperZoom(pinchState.startZoom * (distance / pinchState.startDistance)));
      }
      return;
    }

    const dragState = dragStateRef.current;

    if (!dragState || !layout) {
      return;
    }

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const nextPanX = canDragX
      ? Math.min(1, Math.max(0, dragState.startPanX - dx / layout.overflowX))
      : panX;
    const nextPanY = canDragY
      ? Math.min(1, Math.max(0, dragState.startPanY - dy / layout.overflowY))
      : panY;

    onPanChange(nextPanX, nextPanY);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    dragStateRef.current = null;
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    onZoomChange(clampWallpaperZoom(zoom - Math.sign(event.deltaY) * ZOOM_STEP));
  };

  const isZoomed = zoom > WALLPAPER_MIN_ZOOM + 0.001;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative touch-none select-none overflow-hidden rounded-xl border border-white/10 bg-black"
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          cursor: canDragX || canDragY ? "grab" : "default",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Kırpma önizlemesi"
          className="pointer-events-none absolute left-0 top-0 max-w-none"
          draggable={false}
          onLoad={(event) => {
            const target = event.currentTarget;
            setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
          }}
          src={imageUrl}
          style={
            layout
              ? {
                  width: layout.displayWidth,
                  height: layout.displayHeight,
                  transform: `translate(${layout.offsetX}px, ${layout.offsetY}px)`,
                }
              : undefined
          }
        />
      </div>

      <div className="flex w-full items-center gap-2" style={{ maxWidth: PREVIEW_WIDTH }}>
        <button
          className="h-7 w-7 shrink-0 rounded-lg border border-white/10 text-sm text-zinc-200 disabled:opacity-40"
          disabled={zoom <= WALLPAPER_MIN_ZOOM}
          onClick={() => onZoomChange(clampWallpaperZoom(zoom - ZOOM_STEP))}
          type="button"
        >
          −
        </button>
        <input
          aria-label="Yakınlaştırma"
          className="w-full accent-fuchsia-400"
          max={WALLPAPER_MAX_ZOOM}
          min={WALLPAPER_MIN_ZOOM}
          onChange={(event) => onZoomChange(clampWallpaperZoom(Number(event.target.value)))}
          step={0.05}
          type="range"
          value={zoom}
        />
        <button
          className="h-7 w-7 shrink-0 rounded-lg border border-white/10 text-sm text-zinc-200 disabled:opacity-40"
          disabled={zoom >= WALLPAPER_MAX_ZOOM}
          onClick={() => onZoomChange(clampWallpaperZoom(zoom + ZOOM_STEP))}
          type="button"
        >
          +
        </button>
        <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">{zoom.toFixed(2)}×</span>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-[10px] text-zinc-500">
          {canDragX || canDragY
            ? "Sürükle · tekerlek veya iki parmakla yakınlaştır."
            : "Görsel hedef orana tam uyuyor. Yakınlaştırarak bir bölümünü seçebilirsin."}
        </p>
        {isZoomed ? (
          <button
            className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300"
            onClick={() => {
              onZoomChange(WALLPAPER_MIN_ZOOM);
              onPanChange(0.5, 0.5);
            }}
            type="button"
          >
            Sıfırla
          </button>
        ) : null}
      </div>
    </div>
  );
}
