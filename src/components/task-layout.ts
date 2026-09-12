// Keep related, similarly sized activities together. Order never depends on live state.
const density: Record<string, number> = {
  claim: 100, 'number-pick': 110, review: 130, 'favor-roulette': 140,
  typing: 200, 'perfect-writing': 210, 'false-hope': 220,
  'confession-writing': 300, 'ownership-oath': 310,
  movement: 400, 'wait-obediently': 410, worship: 500, 'evil-wait': 510,
  'case-open': 600, 'timeout-risk': 610, 'irl-wheel': 620, 'high-low': 900,
};
const companions = [
  ['claim', 'number-pick'], ['review', 'false-hope'], ['review', 'review'],
  ['perfect-writing', 'favor-roulette'], ['confession-writing', 'ownership-oath'],
  ['typing', 'wait-obediently'], ['worship', 'evil-wait'], ['case-open', 'timeout-risk'],
];
export function arrangeTaskCards<T extends {kind: string}>(tasks: readonly T[]): T[] {
  const remaining = [...tasks];
  const pairs: T[][] = [];
  for (const [firstKind, secondKind] of companions) {
    const first = remaining.findIndex(task => task.kind === firstKind);
    const second = remaining.findIndex((task, index) => index !== first && task.kind === secondKind);
    if (first < 0 || second < 0) continue;
    pairs.push([remaining[first], remaining[second]]);
    remaining.splice(Math.max(first, second), 1);
    remaining.splice(Math.min(first, second), 1);
  }
  const size = (task: T) => density[task.kind] ?? 450;
  pairs.sort((a, b) => size(a[0]) - size(b[0]));
  remaining.sort((a, b) => size(a) - size(b));
  return [...pairs.flat(), ...remaining];
}
