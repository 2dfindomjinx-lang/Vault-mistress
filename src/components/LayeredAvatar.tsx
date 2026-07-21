import Image from "next/image";
import type { CSSProperties } from "react";
import {
  getAvatarBaseModelPath,
  resolveFullSetImagePath,
  type EquippedAvatarSlots,
  getRenderedAvatarLayers,
} from "@/lib/avatar-slots";

type LayeredAvatarProps = {
  alt: string;
  className?: string;
  equipped: EquippedAvatarSlots;
  equippedFullSetId?: string | null;
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
  equippedFullSetId = null,
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
      {equippedFullSetId ? (
        // Full Set: a single pre-rendered illustration replaces the base model
        // and every layer entirely - nothing else below this renders.
        <Image
          alt={alt}
          className={imageClassName}
          fill
          priority={priority}
          src={resolveFullSetImagePath(equippedFullSetId)}
          unoptimized
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
