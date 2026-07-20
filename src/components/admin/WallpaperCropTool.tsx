"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { WALLPAPER_TARGET_ASPECT_RATIO, getWallpaperCoverLayout } from "@/lib/wallpaper-crop";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH / WALLPAPER_TARGET_ASPECT_RATIO);

type WallpaperCropToolProps = {
  file: File;
  panX: number;
  panY: number;
  onPanChange: (panX: number, panY: number) => void;
};

export function WallpaperCropTool({ file, panX, panY, onPanChange }: WallpaperCropToolProps) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [trackedFile, setTrackedFile] = useState(file);
  const dragStateRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

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
    ? getWallpaperCoverLayout(naturalSize.width, naturalSize.height, PREVIEW_WIDTH, PREVIEW_HEIGHT, panX, panY)
    : null;
  const canDragX = Boolean(layout && layout.overflowX > 0);
  const canDragY = Boolean(layout && layout.overflowY > 0);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layout || (!canDragX && !canDragY)) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, startPanX: panX, startPanY: panY };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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

    dragStateRef.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative touch-none select-none overflow-hidden rounded-xl border border-white/10 bg-black"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
      <p className="text-[10px] text-zinc-500">
        {canDragX || canDragY ? "Görünecek kısmı ayarlamak için sürükle." : "Görsel zaten hedef orana tam uyuyor."}
      </p>
    </div>
  );
}
