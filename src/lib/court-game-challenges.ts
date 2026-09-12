import { CROWN_MATCH_MAX_MISTAKES } from "@/lib/court-games";
function shuffled<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

type SaysRound = {
  action: "bow" | "kneel" | "still" | "type";
  command: string;
  expectedText?: string;
  shouldObey: boolean;
  timeMs: number;
};

// A pool, not a script. Eight rounds are drawn fresh each run - with the fixed
// list of eight, three days of play memorised the whole game and it stopped
// being a listening test. Traps borrow every voice of authority EXCEPT the one
// that counts: only “Principessa Says” is real.
const SAYS_OBEY_POOL: readonly SaysRound[] = [
  {
    action: "kneel",
    command: "Principessa Says: Kneel.",
    shouldObey: true,
    timeMs: 4_500,
  },
  {
    action: "bow",
    command: "Principessa Says: Bow.",
    shouldObey: true,
    timeMs: 4_000,
  },
  {
    action: "still",
    command: "Principessa Says: Do not move.",
    shouldObey: true,
    timeMs: 4_000,
  },
  {
    action: "still",
    command: "Principessa Says: Freeze. Eyes down.",
    shouldObey: true,
    timeMs: 4_500,
  },
  {
    action: "kneel",
    command: "Principessa Says: On your knees. Now.",
    shouldObey: true,
    timeMs: 4_000,
  },
  {
    action: "bow",
    command: "Principessa Says: Lower your head.",
    shouldObey: true,
    timeMs: 4_000,
  },
  {
    action: "still",
    command: "Principessa Says: Hold still until I allow otherwise.",
    shouldObey: true,
    timeMs: 5_000,
  },
  {
    action: "kneel",
    command: "Principessa Says: Kneel and be grateful.",
    shouldObey: true,
    timeMs: 4_500,
  },
  {
    action: "type",
    command: "Principessa Says: Type “Meow, Principessa.”",
    expectedText: "Meow, Principessa.",
    shouldObey: true,
    timeMs: 7_000,
  },
  {
    action: "type",
    command: "Principessa Says: Type “Woof! Woof!”",
    expectedText: "Woof! Woof!",
    shouldObey: true,
    timeMs: 7_000,
  },
  {
    action: "type",
    command: "Principessa Says: Type “I belong to her.”",
    expectedText: "I belong to her.",
    shouldObey: true,
    timeMs: 8_000,
  },
  {
    action: "type",
    command: "Principessa Says: Type “Thank you.”",
    expectedText: "Thank you.",
    shouldObey: true,
    timeMs: 6_000,
  },
  {
    action: "type",
    command: "Principessa Says: Type “Yes, Principessa.”",
    expectedText: "Yes, Principessa.",
    shouldObey: true,
    timeMs: 7_000,
  },
  {
    action: "bow",
    command: "Principessa Says: Bow. Deeper.",
    shouldObey: true,
    timeMs: 4_000,
  },
];

const SAYS_TRAP_POOL: readonly SaysRound[] = [
  {
    action: "bow",
    command: "Bow for Principessa.",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "kneel",
    command: "Kneel. Principessa is watching.",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "type",
    command: "Principessa wants you to type “Woof!”",
    expectedText: "Woof!",
    shouldObey: false,
    timeMs: 5_000,
  },
  {
    action: "kneel",
    command: "The court commands: Kneel.",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "bow",
    command: "Your Mistress expects a bow.",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "type",
    command: "Type “Yes, Principessa.” if you are loyal.",
    expectedText: "Yes, Principessa.",
    shouldObey: false,
    timeMs: 5_500,
  },
  {
    action: "kneel",
    command: "Principessa said to kneel, did she not?",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "bow",
    command: "Everyone is bowing. Join them.",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "still",
    command: "Quick! Do something before time runs out!",
    shouldObey: false,
    timeMs: 4_000,
  },
  {
    action: "type",
    command: "Prove yourself. Type “I obey.”",
    expectedText: "I obey.",
    shouldObey: false,
    timeMs: 5_000,
  },
];

// Five real orders, three traps, shuffled together. Always eight, because the
// server refuses any other round count.
function drawSaysRounds(random: () => number) {
  return shuffled(
    [
      ...shuffled(SAYS_OBEY_POOL, random).slice(0, 5),
      ...shuffled(SAYS_TRAP_POOL, random).slice(0, 3),
    ],
    random,
  );
}

export const CROWN_SYMBOLS = ["♛", "♦", "♥", "✦", "⚜", "◈", "lock", "coin", "pet"] as const;
type GuardTarget = { glyph: string; label: string; threat: boolean };
const GUARD_THREATS: readonly GuardTarget[] = [
  { glyph: "☠", label: "Intruder", threat: true },
  { glyph: "⚡", label: "Saboteur", threat: true },
  { glyph: "✖", label: "Stalker", threat: true },
];
const GUARD_GIFTS: readonly GuardTarget[] = [
  { glyph: "💐", label: "Bouquet", threat: false },
  { glyph: "💎", label: "Jewel", threat: false },
  { glyph: "✉", label: "Love letter", threat: false },
];

// Waves get faster in thirds. The first third is deliberately slow enough to
// learn the rule while playing it - the old version gave 720ms flat from wave
// one, which is why first-timers failed before understanding the game.
export function guardWaveDuration(index: number) {
  if (index < 6) return 1_700;
  if (index < 12) return 1_250;
  return 900;
}

function drawGuardTargets(random: () => number) {
  return Array.from({ length: 18 }, (_, index) => {
    const pool =
      index % 3 === 0
        ? GUARD_GIFTS
        : random() > 0.46
          ? GUARD_THREATS
          : GUARD_GIFTS;
    return pool[Math.floor(random() * pool.length)];
  });
}

export function createCourtChallenge(seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return {
    says: drawSaysRounds(random),
    cards: shuffled(
      CROWN_SYMBOLS.flatMap((symbol) => [symbol, symbol]),
      random,
    ).map((symbol, id) => ({ id, symbol })),
    targets: drawGuardTargets(random),
  };
}
export type CourtAction = { action: string; atMs: number };
export function verifyCourtActions(
  gameId: string,
  seed: number,
  actions: unknown,
  elapsedMs: number,
) {
  if (!Array.isArray(actions) || actions.length > 220 || actions.length === 0)
    return null;
  let prior = 0;
  for (const a of actions) {
    if (
      !a ||
      typeof a.action !== "string" ||
      a.action.length > 180 ||
      !Number.isFinite(a.atMs) ||
      a.atMs < prior ||
      a.atMs > elapsedMs + 1000
    )
      return null;
    prior = a.atMs;
  }
  const challenge = createCourtChallenge(seed);
  let score = 0;
  let mistakes = 0;
  if (gameId === "crown-match") {
    if (actions.length % 2) return null;
    const matched = new Set<number>();
    for (let i = 0; i < actions.length; i += 2) {
      const x = actions[i],
        y = actions[i + 1];
      if (!/^\d+$/.test(x.action) || !/^\d+$/.test(y.action)) return null;
      const a = Number(x.action),
        b = Number(y.action);
      if (
        a === b ||
        !challenge.cards[a] ||
        !challenge.cards[b] ||
        matched.has(a) ||
        matched.has(b)
      )
        return null;
      if (challenge.cards[a].symbol === challenge.cards[b].symbol) {
        matched.add(a);
        matched.add(b);
        score++;
      } else if (++mistakes >= CROWN_MATCH_MAX_MISTAKES) return null;
    }
    if (score !== CROWN_SYMBOLS.length) return null;
    return { score, mistakes, roundsCompleted: CROWN_SYMBOLS.length };
  }
  const rounds =
    gameId === "principessa-says" ? challenge.says : challenge.targets;
  if (actions.length !== rounds.length) return null;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i].action;
    const delta = actions[i].atMs - (i ? actions[i - 1].atMs : 0);
    let correct = false;
    if (gameId === "principessa-says") {
      const round = challenge.says[i];
      if (
        !["wait", "bow", "kneel"].includes(action) &&
        !action.startsWith("type:")
      )
        return null;
      if (action === "wait" && delta < round.timeMs - 250) return null;
      correct =
        action === "wait"
          ? !round.shouldObey || round.action === "still"
          : round.shouldObey &&
            (round.action === "type"
              ? action === "type:" + round.expectedText
              : action === round.action);
    } else if (gameId === "royal-guard") {
      if (!["hit", "wait"].includes(action)) return null;
      if (action === "wait" && delta < guardWaveDuration(i) - 150) return null;
      correct = challenge.targets[i].threat
        ? action === "hit"
        : action === "wait";
    } else return null;
    if (correct) score++;
    else mistakes++;
  }
  return { score, mistakes, roundsCompleted: rounds.length };
}
