// Target ratio for the phone lock/home screen wallpaper. Adjust this if the
// live-wallpaper Android app renders a different screen ratio - everything
// else (preview tool + upload output size) derives from this one constant.
export const WALLPAPER_TARGET_ASPECT_RATIO = 9 / 19.5;

export const WALLPAPER_OUTPUT_WIDTH = 1080;
export const WALLPAPER_OUTPUT_HEIGHT = Math.round(WALLPAPER_OUTPUT_WIDTH / WALLPAPER_TARGET_ASPECT_RATIO);

export const WALLPAPER_MIN_ZOOM = 1;
export const WALLPAPER_MAX_ZOOM = 5;

export function clampWallpaperZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return WALLPAPER_MIN_ZOOM;
  return Math.min(WALLPAPER_MAX_ZOOM, Math.max(WALLPAPER_MIN_ZOOM, zoom));
}

export type WallpaperCropLayout = {
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  overflowX: number;
  overflowY: number;
};

/**
 * "Cover" layout math shared by the preview tool and the final export canvas.
 * panX/panY are 0..1 fractions of how far the crop window has been slid across
 * whichever axis overflows (0 = left/top edge visible, 1 = right/bottom edge,
 * 0.5 = centered).
 *
 * zoom multiplies the cover scale: 1 fits the image to the frame the short way
 * (the old fixed behavior), higher values crop tighter into the middle of the
 * image so only part of it becomes the wallpaper.
 */
export function getWallpaperCoverLayout(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
  panX: number,
  panY: number,
  zoom: number = WALLPAPER_MIN_ZOOM,
): WallpaperCropLayout {
  const naturalRatio = naturalWidth / naturalHeight;
  const boxRatio = boxWidth / boxHeight;
  const coverScale = naturalRatio > boxRatio ? boxHeight / naturalHeight : boxWidth / naturalWidth;
  const scale = coverScale * clampWallpaperZoom(zoom);

  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const overflowX = Math.max(0, displayWidth - boxWidth);
  const overflowY = Math.max(0, displayHeight - boxHeight);
  const clampedPanX = Math.min(1, Math.max(0, panX));
  const clampedPanY = Math.min(1, Math.max(0, panY));

  return {
    displayWidth,
    displayHeight,
    offsetX: -overflowX * clampedPanX,
    offsetY: -overflowY * clampedPanY,
    overflowX,
    overflowY,
  };
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded."));
    };
    image.src = url;
  });
}

export async function cropWallpaperImage(
  file: File,
  panX: number,
  panY: number,
  zoom: number = WALLPAPER_MIN_ZOOM,
): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = WALLPAPER_OUTPUT_WIDTH;
  canvas.height = WALLPAPER_OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  const layout = getWallpaperCoverLayout(
    image.naturalWidth,
    image.naturalHeight,
    WALLPAPER_OUTPUT_WIDTH,
    WALLPAPER_OUTPUT_HEIGHT,
    panX,
    panY,
    zoom,
  );
  ctx.drawImage(image, layout.offsetX, layout.offsetY, layout.displayWidth, layout.displayHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop export failed."))),
      "image/jpeg",
      0.92,
    );
  });
}
