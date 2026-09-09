import Image from "next/image";
import { CourtGlyph } from "./CourtVisuals";

export function DrainScene({
  active,
  total,
  balance,
  rate,
  memory,
}: {
  active: boolean;
  total: number;
  balance: number;
  rate: number;
  memory?: { path: string; title: string };
}) {
  const remaining = Math.max(0, balance - total);
  const remainingPercent = balance > 0 ? (remaining / balance) * 100 : 0;
  return (
    <div className="shrine-drain-scene" data-active={active}>
      <div className="shrine-drain-memory">
        {memory ? (
          <Image
            src={memory.path}
            alt={memory.title}
            fill
            sizes="(max-width: 640px) 32vw, 200px"
            className="object-cover"
          />
        ) : (
          <CourtGlyph symbol="crown" />
        )}
        <div className="shrine-coin-stream" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <i
              key={index}
              style={{
                animationDelay: `${-index * 0.45}s`,
                left: `${20 + index * 11}%`,
              }}
            >
              ✦
            </i>
          ))}
        </div>
      </div>
      <div className="shrine-drain-ledger">
        <p className="court-eyebrow">
          {active
            ? "Flowing to her"
            : total > 0
              ? "Your last offering"
              : "An offering in motion"}
        </p>
        <strong className="shrine-drain-total" key={total}>
          {total.toLocaleString()} <small>Coins</small>
        </strong>
        <div
          className="shrine-reservoir"
          role="progressbar"
          aria-label="Session balance remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remainingPercent)}
        >
          <span style={{ width: `${remainingPercent}%` }} />
        </div>
        <div className="shrine-drain-stats">
          <span>{remaining.toLocaleString()} remaining</span>
          <span>{rate.toLocaleString()} / sec</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-pink-100/55">
          {active
            ? "Her memories unfold as the offering flows."
            : total > 0
              ? "The offering rests. Begin again when you choose."
              : "Choose the pace. Begin when you are ready."}
        </p>
      </div>
    </div>
  );
}

export function ClickStageTrack({
  stage,
  progress,
  thresholds,
}: {
  stage: number;
  progress: number;
  thresholds: readonly number[];
}) {
  const previous = stage > 0 ? thresholds[stage - 1] : 0;
  const next = thresholds[stage];
  const percent =
    next === undefined
      ? 100
      : Math.min(
          100,
          Math.max(0, ((progress - previous) / (next - previous)) * 100),
        );
  return (
    <div className="court-click-progress">
      <div
        className="court-click-stage-track"
        aria-label={`Stage ${stage} of ${thresholds.length}`}
      >
        {thresholds.map((threshold, index) => (
          <span
            key={threshold}
            data-reached={stage > index}
            data-next={stage === index}
            title={`Stage ${index + 1} · ${threshold.toLocaleString()} clicks`}
          >
            {index + 1}
          </span>
        ))}
      </div>
      <div
        className="shrine-reservoir"
        role="progressbar"
        aria-label="Progress to next stage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-pink-50/80">
        {next === undefined
          ? "Every stage revealed."
          : `${Math.max(0, next - progress).toLocaleString()} more clicks to reveal stage ${stage + 1}`}
      </p>
    </div>
  );
}
