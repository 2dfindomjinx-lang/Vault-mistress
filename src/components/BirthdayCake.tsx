"use client";

import { BIRTHDAY_TARGET_CANDLES, resolveSupporterLabel, type BirthdayCandle } from "@/lib/birthday";

// Geometry is fixed in viewBox units and scaled by CSS, so the cake stays
// identical on a phone and on a projector. The viewBox is cropped to where the
// art actually starts (the top of the tallest candle halo) rather than to 0.
const VIEW_WIDTH = 640;
const VIEW_TOP = 150;
const VIEW_HEIGHT = 396;

const TOP_TIER = { height: 84, width: 400, x: 120, y: 296 };
const MID_TIER = { height: 46, width: 480, x: 80, y: 380 };
const BOTTOM_TIER = { height: 62, width: 540, x: 50, y: 426 };
const PLATE_Y = BOTTOM_TIER.y + BOTTOM_TIER.height;

const CANDLE_HEIGHT = 54;
const CANDLE_WIDTH = 9;
const CANDLE_INSET = 10;

// 22 holders spread across the top tier. Positions are computed rather than
// listed so changing BIRTHDAY_TARGET_CANDLES re-spaces the cake on its own.
function getCandleX(index: number) {
  const usable = TOP_TIER.width - CANDLE_INSET * 2;
  const step = BIRTHDAY_TARGET_CANDLES > 1 ? usable / (BIRTHDAY_TARGET_CANDLES - 1) : 0;
  return TOP_TIER.x + CANDLE_INSET + (index - 1) * step;
}

// Frosting drips along a tier's top edge. Depths come from the index rather
// than Math.random so the shape is stable across renders (and lint-clean).
function dripsFor(tier: { width: number; x: number; y: number }, count: number, key: string) {
  return Array.from({ length: count }, (_, drip) => {
    const x = tier.x + 22 + drip * ((tier.width - 44) / Math.max(1, count - 1));
    const depth = 9 + ((drip * 7) % 12);
    return (
      <ellipse cx={x} cy={tier.y + 7} fill="url(#vm-frosting)" key={`${key}-${drip}`} rx="8.5" ry={depth} />
    );
  });
}

export function BirthdayCake({ candles }: { candles: BirthdayCandle[] }) {
  const litCount = candles.filter((candle) => candle.litAt).length;
  // The cake itself gets warmer as candles are lit - a dark cake at 0 and a
  // cake bathed in candlelight at 22. This is the main "it is filling up"
  // signal beyond the candles themselves.
  const warmth = Math.min(1, litCount / BIRTHDAY_TARGET_CANDLES);

  return (
    <div className="relative w-full">
      <style>{`
        @keyframes vm-flame-dance {
          0%, 100% { transform: translate(-0.5px, 0) rotate(-2deg) scale(0.96, 1.04); }
          28%      { transform: translate(1px, -1px) rotate(3deg) scale(0.88, 1.13); }
          58%      { transform: translate(-1px, 0.5px) rotate(-4deg) scale(1.05, 0.94); }
          82%      { transform: translate(0.5px, -0.5px) rotate(1deg) scale(0.93, 1.08); }
        }
        @keyframes vm-flame-core {
          0%, 100% { opacity: 0.96; transform: scale(0.82, 0.9); }
          50%      { opacity: 0.72; transform: scale(0.68, 1.04); }
        }
        @keyframes vm-glow-breathe {
          0%, 100% { opacity: 0.52; transform: scale(0.96); }
          50%      { opacity: 0.28; transform: scale(1.12); }
        }
        @keyframes vm-spark-rise {
          0%   { opacity: 0; transform: translate(0, 2px) scale(0.6); }
          22%  { opacity: 0.9; }
          100% { opacity: 0; transform: translate(5px, -22px) scale(0.15); }
        }
        @keyframes vm-candle-awaken {
          0%   { opacity: 0.45; transform: translateY(5px) scaleY(0.93); }
          70%  { opacity: 1; transform: translateY(-1px) scaleY(1.02); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .vm-flame-shell {
          animation: vm-flame-dance 1.45s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        .vm-flame-core {
          animation: vm-flame-core 1.1s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        .vm-glow {
          animation: vm-glow-breathe 2.1s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .vm-spark {
          animation: vm-spark-rise 2.8s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .vm-candle-lit {
          animation: vm-candle-awaken 0.65s cubic-bezier(.2,.8,.2,1) both;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        @media (prefers-reduced-motion: reduce) {
          .vm-flame-shell, .vm-flame-core, .vm-glow, .vm-spark, .vm-candle-lit { animation: none; }
        }
      `}</style>

      <svg
        aria-label={`Birthday cake with ${litCount} of ${BIRTHDAY_TARGET_CANDLES} candles lit`}
        className="h-auto w-full"
        role="img"
        viewBox={`0 ${VIEW_TOP} ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="vm-tier" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6b1a3c" />
            <stop offset="55%" stopColor="#431126" />
            <stop offset="100%" stopColor="#230814" />
          </linearGradient>
          <linearGradient id="vm-frosting" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fff1d6" />
            <stop offset="55%" stopColor="#f0c890" />
            <stop offset="100%" stopColor="#d9a55f" />
          </linearGradient>
          <linearGradient id="vm-plate" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7a5a2c" />
            <stop offset="50%" stopColor="#e6ba73" />
            <stop offset="100%" stopColor="#7a5a2c" />
          </linearGradient>
          <radialGradient id="vm-flame-fill" cx="50%" cy="72%" r="60%">
            <stop offset="0%" stopColor="#fffdf0" />
            <stop offset="38%" stopColor="#ffd65c" />
            <stop offset="76%" stopColor="#ff8a24" />
            <stop offset="100%" stopColor="#e84315" />
          </radialGradient>
          <linearGradient id="vm-flame-core-fill" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#fffef3" />
            <stop offset="60%" stopColor="#fff3a6" />
            <stop offset="100%" stopColor="#ffc83d" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="vm-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf67" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#ffbe4d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vm-ambient" cx="50%" cy="30%" r="55%">
            <stop offset="0%" stopColor="#ffb454" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffb454" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="vm-sheen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vm-candle-lit" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7f173f" />
            <stop offset="42%" stopColor="#f8cfde" />
            <stop offset="68%" stopColor="#fff2e1" />
            <stop offset="100%" stopColor="#a92255" />
          </linearGradient>
          <linearGradient id="vm-candle-unlit" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#24131e" />
            <stop offset="48%" stopColor="#563047" />
            <stop offset="72%" stopColor="#392132" />
            <stop offset="100%" stopColor="#180e15" />
          </linearGradient>
          <linearGradient id="vm-candle-holder" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6f481c" />
            <stop offset="48%" stopColor="#f0c879" />
            <stop offset="100%" stopColor="#81551f" />
          </linearGradient>
          <filter height="300%" id="vm-flame-glow" width="300%" x="-100%" y="-100%">
            <feGaussianBlur result="blur" stdDeviation="2.6" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient candlelight. Both the reach and the strength scale with
            progress: at 0.25 base opacity and a fixed 300x180 radius, two lit
            candles still washed the entire cake and made the cake look nearly
            as warm as a full one. Two flames now light a small pool near the
            top tier, and the glow grows out to cover the cake as the holders
            fill. */}
        <ellipse
          cx={VIEW_WIDTH / 2}
          cy="300"
          fill="url(#vm-ambient)"
          opacity={0.06 + warmth * 0.84}
          rx={130 + warmth * 170}
          ry={78 + warmth * 102}
        />

        {/* Pedestal plate */}
        <ellipse cx={VIEW_WIDTH / 2} cy={PLATE_Y + 16} fill="#0d0709" rx="300" ry="26" />
        <rect fill="url(#vm-plate)" height="7" rx="3.5" width="600" x="20" y={PLATE_Y + 6} />
        <path
          d={`M${VIEW_WIDTH / 2 - 34} ${PLATE_Y + 13} L${VIEW_WIDTH / 2 - 20} ${PLATE_Y + 40} L${VIEW_WIDTH / 2 + 20} ${PLATE_Y + 40} L${VIEW_WIDTH / 2 + 34} ${PLATE_Y + 13} Z`}
          fill="#2a1c12"
          stroke="#c89a55"
          strokeOpacity="0.4"
        />
        <ellipse cx={VIEW_WIDTH / 2} cy={PLATE_Y + 44} fill="url(#vm-plate)" rx="62" ry="9" />

        {/* Bottom tier */}
        <rect
          fill="url(#vm-tier)"
          height={BOTTOM_TIER.height}
          rx="10"
          stroke="#c89a55"
          strokeOpacity="0.34"
          width={BOTTOM_TIER.width}
          x={BOTTOM_TIER.x}
          y={BOTTOM_TIER.y}
        />
        <rect fill="url(#vm-sheen)" height={BOTTOM_TIER.height / 2} rx="10" width={BOTTOM_TIER.width} x={BOTTOM_TIER.x} y={BOTTOM_TIER.y} />
        <rect fill="url(#vm-frosting)" height="13" rx="6.5" width={BOTTOM_TIER.width} x={BOTTOM_TIER.x} y={BOTTOM_TIER.y - 4} />
        {dripsFor(BOTTOM_TIER, 13, "drip-bottom")}

        {/* Middle tier */}
        <rect
          fill="url(#vm-tier)"
          height={MID_TIER.height}
          rx="10"
          stroke="#c89a55"
          strokeOpacity="0.34"
          width={MID_TIER.width}
          x={MID_TIER.x}
          y={MID_TIER.y}
        />
        <rect fill="url(#vm-sheen)" height={MID_TIER.height / 2} rx="10" width={MID_TIER.width} x={MID_TIER.x} y={MID_TIER.y} />
        <rect fill="url(#vm-frosting)" height="12" rx="6" width={MID_TIER.width} x={MID_TIER.x} y={MID_TIER.y - 4} />
        {dripsFor(MID_TIER, 11, "drip-mid")}

        {/* Top tier */}
        <rect
          fill="url(#vm-tier)"
          height={TOP_TIER.height}
          rx="10"
          stroke="#c89a55"
          strokeOpacity="0.34"
          width={TOP_TIER.width}
          x={TOP_TIER.x}
          y={TOP_TIER.y}
        />
        <rect fill="url(#vm-sheen)" height={TOP_TIER.height / 2} rx="10" width={TOP_TIER.width} x={TOP_TIER.x} y={TOP_TIER.y} />
        <rect fill="url(#vm-frosting)" height="12" rx="6" width={TOP_TIER.width} x={TOP_TIER.x} y={TOP_TIER.y - 4} />
        {dripsFor(TOP_TIER, 9, "drip-top")}

        {/* Gold piping dots along each tier seam */}
        {[
          { count: 17, tier: BOTTOM_TIER },
          { count: 15, tier: MID_TIER },
          { count: 13, tier: TOP_TIER },
        ].map(({ count, tier }, tierIndex) =>
          Array.from({ length: count }, (_, dot) => (
            <circle
              cx={tier.x + 16 + dot * ((tier.width - 32) / (count - 1))}
              cy={tier.y + tier.height - 9}
              fill="#e6ba73"
              key={`pip-${tierIndex}-${dot}`}
              opacity="0.5"
              r="2.4"
            />
          )),
        )}

        {/* Cherries on the bottom tier, because a bare cake reads unfinished */}
        {Array.from({ length: 5 }, (_, cherry) => {
          const x = BOTTOM_TIER.x + 70 + cherry * ((BOTTOM_TIER.width - 140) / 4);
          return (
            <g key={`cherry-${cherry}`}>
              <circle cx={x} cy={BOTTOM_TIER.y + 26} fill="#9f1239" r="7" />
              <circle cx={x - 2.2} cy={BOTTOM_TIER.y + 23.5} fill="#fda4af" opacity="0.75" r="2.1" />
              <path d={`M${x} ${BOTTOM_TIER.y + 19} q 5 -8 11 -9`} fill="none" stroke="#4d7c0f" strokeWidth="1.6" />
            </g>
          );
        })}

        {/* Candles */}
        {candles.map((candle) => {
          const x = getCandleX(candle.index);
          const baseY = TOP_TIER.y - 2;
          const topY = baseY - CANDLE_HEIGHT;
          const isLit = Boolean(candle.litAt);
          const motionDelay = -((candle.index % 9) * 0.17);

          return (
            <g
              className={isLit ? "vm-candle-lit" : undefined}
              key={candle.index}
              style={isLit ? { animationDelay: `${candle.index * 28}ms` } : undefined}
            >
              {/* A small gold cup keeps the row from reading like floating bars. */}
              <ellipse
                cx={x}
                cy={baseY + 1}
                fill="url(#vm-candle-holder)"
                opacity={isLit ? 1 : 0.48}
                rx="7.2"
                ry="2.5"
              />

              <rect
                fill={isLit ? "url(#vm-candle-lit)" : "url(#vm-candle-unlit)"}
                height={CANDLE_HEIGHT}
                rx="3.5"
                stroke={isLit ? "#f2cf8a" : "#70445d"}
                strokeOpacity={isLit ? 0.9 : 0.42}
                strokeWidth="1"
                width={CANDLE_WIDTH}
                x={x - CANDLE_WIDTH / 2}
                y={topY}
              />
              <ellipse
                cx={x}
                cy={topY + 2}
                fill={isLit ? "#fff1df" : "#553247"}
                opacity={isLit ? 0.95 : 0.62}
                rx="3.8"
                ry="1.7"
              />
              <path
                d={`M${x + 2.2} ${topY + 7} V${baseY - 6}`}
                opacity={isLit ? 0.42 : 0.16}
                stroke="#ffffff"
                strokeLinecap="round"
                strokeWidth="1.1"
              />

              {isLit
                ? [15, 28, 41].map((offset) => (
                    <path
                      d={`M${x - 4} ${topY + offset + 3} L${x + 4} ${topY + offset - 3}`}
                      key={`band-${candle.index}-${offset}`}
                      opacity="0.52"
                      stroke="#be185d"
                      strokeLinecap="round"
                      strokeWidth="2.2"
                    />
                  ))
                : null}

              <line
                stroke={isLit ? "#3b2318" : "#21151c"}
                strokeLinecap="round"
                strokeWidth="1.7"
                x1={x}
                x2={x}
                y1={topY + 1}
                y2={topY - 5}
              />

              {isLit ? (
                <>
                  <circle
                    className="vm-glow"
                    cx={x}
                    cy={topY - 15}
                    fill="url(#vm-halo)"
                    r="29"
                    style={{ animationDelay: `${motionDelay}s` }}
                  />
                  <g
                    className="vm-flame-shell"
                    filter="url(#vm-flame-glow)"
                    style={{ animationDelay: `${motionDelay}s` }}
                  >
                    <path
                      d={`M${x} ${topY - 3} C${x - 8} ${topY - 10},${x - 6} ${topY - 21},${x + 1} ${topY - 31} C${x + 2} ${topY - 21},${x + 9} ${topY - 16},${x + 6} ${topY - 8} C${x + 4} ${topY - 4},${x + 2} ${topY - 3},${x} ${topY - 3}Z`}
                      fill="url(#vm-flame-fill)"
                    />
                    <path
                      className="vm-flame-core"
                      d={`M${x} ${topY - 4} C${x - 3.8} ${topY - 9},${x - 2.7} ${topY - 16},${x + 0.5} ${topY - 22} C${x + 1.2} ${topY - 15},${x + 4.2} ${topY - 12},${x + 3.2} ${topY - 7} C${x + 2} ${topY - 4.5},${x + 1} ${topY - 4},${x} ${topY - 4}Z`}
                      fill="url(#vm-flame-core-fill)"
                      style={{ animationDelay: `${motionDelay * 0.7}s` }}
                    />
                  </g>
                  <circle
                    className="vm-spark"
                    cx={x + 4}
                    cy={topY - 22}
                    fill="#ffd979"
                    r="1.25"
                    style={{ animationDelay: `${motionDelay * 1.6}s` }}
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Screen-reader / no-JS friendly roster of who lit what. */}
      <ul className="sr-only">
        {candles
          .filter((candle) => candle.litAt)
          .map((candle) => (
            <li key={candle.index}>{`Candle ${candle.index} lit by ${resolveSupporterLabel(candle)}`}</li>
          ))}
      </ul>
    </div>
  );
}
