"use client";

// A wrapped present, drawn parametrically so every gift tier gets the same box
// in its own colours instead of five hand-drawn assets. `seed` nudges the bow
// and the tilt so the row does not read as one shape copied five times.
export function BirthdayGiftBox({
  accent,
  className = "",
  ribbon,
  seed = 0,
}: {
  accent: string;
  className?: string;
  ribbon: string;
  seed?: number;
}) {
  const lidTilt = -3 + (seed % 3) * 3;
  const bowSpread = 15 + (seed % 4) * 2.5;
  const gradientId = `gift-body-${seed}`;
  const shineId = `gift-shine-${seed}`;

  return (
    <svg className={className} fill="none" viewBox="0 0 120 116" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={ribbon} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="60" cy="106" fill="#000000" opacity="0.4" rx="40" ry="7" />

      {/* Body */}
      <rect fill={`url(#${gradientId})`} height="60" rx="6" width="80" x="20" y="44" />
      <rect fill={`url(#${shineId})`} height="60" rx="6" width="80" x="20" y="44" />
      {/* Vertical ribbon down the body */}
      <rect fill={ribbon} height="60" width="13" x="53.5" y="44" />
      <rect fill="#ffffff" height="60" opacity="0.16" width="4" x="55" y="44" />

      {/* Lid */}
      <g transform={`rotate(${lidTilt} 60 38)`}>
        <rect fill={accent} height="18" rx="5" width="92" x="14" y="30" />
        <rect fill={`url(#${shineId})`} height="18" rx="5" width="92" x="14" y="30" />
        <rect fill={ribbon} height="18" width="13" x="53.5" y="30" />
      </g>

      {/* Bow */}
      <g transform={`rotate(${lidTilt} 60 30)`}>
        <path
          d={`M60 30 C ${60 - bowSpread} 30, ${60 - bowSpread - 8} 12, 60 14 C ${60 + bowSpread + 8} 12, ${60 + bowSpread} 30, 60 30 Z`}
          fill={ribbon}
          stroke={accent}
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <circle cx="60" cy="27" fill={accent} r="4.5" />
      </g>
    </svg>
  );
}
