import Image from "next/image";
import type { CSSProperties } from "react";
import {
  getAvatarBaseModelPath,
  type EquippedAvatarSlots,
  getRenderedAvatarLayers,
} from "@/lib/avatar-slots";

type LayeredAvatarProps = {
  alt: string;
  className?: string;
  equipped: EquippedAvatarSlots;
  hasUncensored?: boolean;
  imageClassName?: string;
  backgroundPath?: string | null;
  backgroundOverlayPath?: string | null;
  backgroundStyle?: CSSProperties;
  priority?: boolean;
};

export function LayeredAvatar({
  alt,
  className,
  equipped,
  hasUncensored = false,
  imageClassName = "object-contain object-center",
  backgroundPath = null,
  backgroundOverlayPath = null,
  backgroundStyle,
  priority = false,
}: LayeredAvatarProps) {
  const layers = getRenderedAvatarLayers(equipped);
  const baseSrc = getAvatarBaseModelPath(equipped, hasUncensored);

  return (
    <div className={`relative overflow-hidden h-full w-full ${className ?? ""}`}>
      {backgroundStyle ? (
        <div aria-hidden="true" className="absolute inset-0" style={backgroundStyle} />
      ) : null}
      {backgroundPath ? (
        <Image
          alt=""
          aria-hidden="true"
          className="object-cover object-center"
          fill
          priority={priority}
          src={backgroundPath}
          unoptimized
        />
      ) : null}
      {backgroundOverlayPath ? (
        <Image
          alt=""
          aria-hidden="true"
          className="object-cover object-center"
          fill
          priority={priority}
          src={backgroundOverlayPath}
          unoptimized
        />
      ) : null}
      <Image
        alt={alt}
        className={imageClassName}
        fill
        priority={priority}
        src={baseSrc}
        unoptimized
      />
      {layers.map((layer) => (
        <Image
          alt=""
          aria-hidden="true"
          className={imageClassName}
          fill
          key={`${layer.slot}:${layer.itemId}`}
          src={layer.src}
          unoptimized
        />
      ))}
    </div>
  );
}
