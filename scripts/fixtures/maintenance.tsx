import { createRoot } from "react-dom/client";
import type { ComponentProps } from "react";
import { TaskList } from "../../src/components/TaskList";
import { LiveChatWidget } from "../../src/components/LiveChatWidget";

const noop = () => {};
const mode = new URLSearchParams(location.search).get("mode");
const props: ComponentProps<typeof TaskList> = {
  coins: 2000, tasks: [{ id: "case-opening", title: "Case Opening", kind: "case-open", reward: 100, completed: false, claimed: false }],
  globalPrincipessaLevel: 1, globalPrincipessaProgressPercent: 0, globalPrincipessaRequirement: 100,
  globalPrincipessaXp: 0, userLevel: 1, userLevelProgressPercent: 0, userXpIntoLevel: 0, userXpRequiredForNext: 100,
  onClaim: noop, onLevelDrain: noop, onIrlTaskSpin: noop, onNumberPick: noop, onMovementFail: noop,
  onMovementFinishFakeHope: noop, onMovementProgress: noop, onMovementStart: noop, onTimeoutRisk: noop,
  onTimeoutRiskMultiplierChange: noop, onTypingProgress: noop, onWaitObedientlyComplete: noop,
  onWaitObedientlyFail: noop, onWaitObedientlyStart: noop, timeoutRiskChance: .2,
  timeoutRiskEffectiveDays: 1, timeoutRiskMaxDays: 1, timeoutRiskTimeoutHours: 24, timeoutRiskReward: 100,
  onCaseOpen: async () => {
    const response = await fetch("/fixture-case");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result.reward;
  },
  onCaseOpenRevealed: (reward) => { document.documentElement.dataset.revealed = String(reward); },
};
createRoot(document.getElementById("fixture")!).render(mode === "chat" ? <LiveChatWidget /> : <TaskList {...props} />);
