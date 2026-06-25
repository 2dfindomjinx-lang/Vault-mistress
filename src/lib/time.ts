export const DAY_MS = 24 * 60 * 60 * 1000;
export const HALF_DAY_MS = 12 * 60 * 60 * 1000;
export const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getGmt3DateKey(date: Date | number | string = new Date()) {
  return new Date(new Date(date).getTime() + GMT3_OFFSET_MS).toISOString().slice(0, 10);
}

export function getGmt3DayIndex(date: Date | number | string = new Date()) {
  return Math.floor((new Date(date).getTime() + GMT3_OFFSET_MS) / DAY_MS);
}

export function getGmt3DayBounds(date: Date | number | string = new Date()) {
  const dayKey = getGmt3DateKey(date);
  const startMs = new Date(`${dayKey}T00:00:00.000Z`).getTime() - GMT3_OFFSET_MS;

  return {
    end: new Date(startMs + DAY_MS),
    start: new Date(startMs),
  };
}

export function getNextGmt3Reset(date: Date | number | string = new Date()) {
  return getGmt3DayBounds(new Date(new Date(date).getTime() + DAY_MS)).start;
}

export function getMsUntilNextGmt3Reset(date: Date | number | string = new Date()) {
  return Math.max(0, getNextGmt3Reset(date).getTime() - new Date(date).getTime());
}

export function getNextGmt3HalfDayReset(date: Date | number | string = new Date()) {
  const nowMs = new Date(date).getTime();
  const gmt3Ms = nowMs + GMT3_OFFSET_MS;
  const nextBoundaryGmt3Ms = (Math.floor(gmt3Ms / HALF_DAY_MS) + 1) * HALF_DAY_MS;

  return new Date(nextBoundaryGmt3Ms - GMT3_OFFSET_MS);
}

export function getMsUntilNextGmt3HalfDayReset(date: Date | number | string = new Date()) {
  return Math.max(0, getNextGmt3HalfDayReset(date).getTime() - new Date(date).getTime());
}

export function isSameGmt3Day(
  left: Date | number | string | null | undefined,
  right: Date | number | string = new Date(),
) {
  if (!left) {
    return false;
  }

  return getGmt3DateKey(left) === getGmt3DateKey(right);
}

export function getDailyGmt3CooldownUntil(
  value: Date | number | string | null | undefined,
  now: Date | number | string = new Date(),
) {
  if (!value || !isSameGmt3Day(value, now)) {
    return null;
  }

  const nextReset = getNextGmt3Reset(value);

  if (new Date(now).getTime() >= nextReset.getTime()) {
    return null;
  }

  return nextReset.toISOString();
}
