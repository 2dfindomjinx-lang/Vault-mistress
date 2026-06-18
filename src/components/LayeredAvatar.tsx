import Image from "next/image";
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
  priority?: boolean;
};

export function LayeredAvatar({
  alt,
  className,
  equipped,
  hasUncensored = false,
  imageClassName = "object-contain object-center",
  priority = false,
}: LayeredAvatarProps) {
  const layers = getRenderedAvatarLayers(equipped);
  const baseSrc = getAvatarBaseModelPath(equipped, hasUncensored);

  return (
    <div className={`relative overflow-hidden h-full w-full ${className ?? ""}`}>
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
