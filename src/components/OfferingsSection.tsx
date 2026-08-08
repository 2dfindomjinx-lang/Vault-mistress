"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  formatPetThroneAmount,
  getPetThroneRewardBreakdown,
  PET_THRONE_AMOUNTS,
  PET_THRONE_TASK_ID,
} from "@/lib/pet-throne";
import {
  getWorshipComplimentPlaceholder,
  PET_WORSHIP_DOWNLOAD_COST,
  PET_WORSHIP_MIN_AMOUNT,
} from "@/lib/pet-tasks-content";
import type { PetTaskItem } from "@/lib/types";
import { useDeadlineClock } from "@/hooks/useDeadlineClock";

const CLICKABLE_COOLDOWN_BUTTON_CLASS = "cursor-not-allowed opacity-40";

function formatRemaining(target: string | null, now: number) {
  if (!target || now <= 0) {
    return "Not scheduled";
  }

  const totalMinutes = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

type OfferingsSectionProps = {
  coins: number;
  disabled?: boolean;
  nextTaxDueAt: string | null;
  pendingPetActionIds: string[];
  // The same petTaskState array PetSection and DebtSection receive. These three
  // offerings are filtered OUT of the pet task grid rather than removed from
  // the array, because coin/XP accounting elsewhere iterates the full list.
  tasks: PetTaskItem[];
  weeklyTaxCost: number;
  onCooldownAttempt?: (message: string) => void;
  onPayWeeklyTax: () => void;
  onCancelThroneTribute: () => void;
  onSubmitThroneTribute: (submission: { amount: number; proofImage: string }) => void;
  onWorshipSubmit: (amount: number, compliment: string) => void;
  onWorshipDownload: () => void;
  worshipCategory?: "feet" | "ass" | "breasts" | null;
  worshipImagePath?: string | null;
  worshipUnlocked?: boolean;
  worshipImageVersion?: number;
};

// Everything that takes coins (or real money) out of the user instead of
// paying them in. Split out of PetSection so the pet grid is purely about
// earning; these live on the Shrine panel next to the other offerings.
export function OfferingsSection({
  coins,
  disabled = false,
  nextTaxDueAt,
  pendingPetActionIds,
  tasks,
  weeklyTaxCost,
  onCooldownAttempt,
  onPayWeeklyTax,
  onCancelThroneTribute,
  onSubmitThroneTribute,
  onWorshipSubmit,
  onWorshipDownload,
  worshipCategory = null,
  worshipImagePath = null,
  worshipUnlocked = false,
  worshipImageVersion = 0,
}: OfferingsSectionProps) {
  const weeklyTaxTask = tasks.find((task) => task.kind === "weekly-tax");
  const worshipTask = tasks.find((task) => task.kind === "worship");
  const throneTask =
    tasks.find((task) => task.id === PET_THRONE_TASK_ID) ??
    ({
      id: PET_THRONE_TASK_ID,
      title: "Throne Bonus",
      description: "Pick a Throne tribute amount, upload the gift screen, and submit it for review.",
      reward: 0,
      kind: "throne-tribute",
      status: "available",
    } as PetTaskItem);

  const now = useDeadlineClock(
    [nextTaxDueAt, weeklyTaxTask?.cooldownUntil, worshipTask?.cooldownUntil, throneTask.cooldownUntil],
    60_000,
  );

  const [selectedThroneAmount, setSelectedThroneAmount] = useState<number>(PET_THRONE_AMOUNTS[0]);
  const [throneProofError, setThroneProofError] = useState("");
  const [throneProofImage, setThroneProofImage] = useState("");
  const [worshipAmountInput, setWorshipAmountInput] = useState("");
  const [worshipComplimentInput, setWorshipComplimentInput] = useState("");

  // Seeds the editable form from whatever draft the server already has. It has
  // to be an effect rather than derived state: once seeded, the user's own
  // picks must survive re-renders instead of snapping back to the saved draft.
  useEffect(() => {
    if (throneTask.throneAmount && throneTask.throneAmount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding local form state from the persisted draft, see above
      setSelectedThroneAmount(throneTask.throneAmount);
    }

    setThroneProofImage(throneTask.throneProofImage ?? "");
    setThroneProofError("");
  }, [throneTask.throneAmount, throneTask.throneProofImage]);

  const isPetActionPending = (actionId: string) => pendingPetActionIds.includes(actionId);
  const handleCooldownAttempt = (message: string) => {
    onCooldownAttempt?.(message);
  };

  const weeklyTaxCoolingDown =
    Boolean(weeklyTaxTask?.cooldownUntil) &&
    new Date(weeklyTaxTask?.cooldownUntil ?? "").getTime() > now;

  const throneCoolingDown =
    Boolean(throneTask.cooldownUntil) && new Date(throneTask.cooldownUntil ?? "").getTime() > now;
  const thronePending = throneTask.status === "pending";
  const throneApproved = throneTask.status === "approved";
  const throneFailed = throneTask.status === "failed";
  const throneActionPending = isPetActionPending(throneTask.id);
  const throneRewardBreakdown = getPetThroneRewardBreakdown(selectedThroneAmount);
  const throneCoinEquivalent = throneRewardBreakdown.totalCoinAmount;
  const throneBadgeLabel = throneFailed
    ? "Rejected"
    : throneApproved
      ? "Approved"
      : thronePending
        ? "In Review"
        : "Tribute";

  const worshipCoolingDown =
    Boolean(worshipTask?.cooldownUntil) && new Date(worshipTask?.cooldownUntil ?? "").getTime() > now;
  const worshipActionPending = worshipTask ? isPetActionPending(worshipTask.id) : false;
  const worshipLocked =
    disabled || worshipCoolingDown || worshipTask?.status === "approved" || worshipActionPending;

  async function handleThroneProofChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setThroneProofError("Please upload an image file.");
      return;
    }

    if (selectedFile.size > 4 * 1024 * 1024) {
      setThroneProofError("Image must stay under 4 MB.");
      return;
    }

    try {
      setThroneProofImage(await fileToDataUrl(selectedFile));
      setThroneProofError("");
    } catch {
      setThroneProofError("Image upload failed.");
    }
  }

  function handleWorshipSubmit() {
    const amount = Math.floor(Number(worshipAmountInput));
    if (!Number.isFinite(amount)) return;
    onWorshipSubmit(amount, worshipComplimentInput);
    setWorshipAmountInput("");
    setWorshipComplimentInput("");
  }

  return (
    <section className="court-feature-panel rounded-[2rem] border border-amber-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(251,191,36,0.1)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-200/70">What She Takes</p>
          <h2 className="text-3xl font-black">Offerings</h2>
        </div>
        <p className="rounded-full border border-amber-200/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-50">
          Balance: {coins.toLocaleString()} coins
        </p>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
        These do not pay you coins - they take them. Pet Score, Devotion and her attention are the
        only things you get back.
      </p>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-2">
        <div className="grid gap-4">
          <div className="court-grid-card court-grid-card--gold rounded-[1.5rem] border border-yellow-200/15 bg-yellow-400/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-yellow-100/70">
                  Weekly Tax
                </p>
                <p className="mt-1 text-sm text-yellow-50">
                  Due in: {formatRemaining(nextTaxDueAt, now)}
                </p>
              </div>
              <span className="rounded-full border border-yellow-100/20 bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-50">
                +{weeklyTaxTask?.reward ?? 0} Pet Score
              </span>
            </div>
            <p className="mt-2 text-xs text-yellow-100/70">
              Tax amount: {weeklyTaxCost} Principessa Coins. Rule: 10% of your coins with a minimum of 2,500 and a maximum of 10,000. If it stays unpaid for 7 days, affection definitely drops.
            </p>
            <button
              aria-disabled={weeklyTaxCoolingDown || undefined}
              className={`mt-4 w-full rounded-2xl border border-yellow-200/25 bg-yellow-500/15 px-4 py-3 text-sm font-black text-yellow-50 transition enabled:hover:border-yellow-200/55 enabled:hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                weeklyTaxCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
              }`}
              disabled={disabled || coins < weeklyTaxCost || isPetActionPending("pet-weekly-throne-tax")}
              onClick={() => {
                if (weeklyTaxCoolingDown) {
                  handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(weeklyTaxTask?.cooldownUntil ?? null, now)}.`);
                  return;
                }

                onPayWeeklyTax();
              }}
              type="button"
            >
              {isPetActionPending("pet-weekly-throne-tax")
                ? "Saving..."
                : weeklyTaxCoolingDown
                ? "Tax Paid"
                : coins < weeklyTaxCost
                  ? `Need ${weeklyTaxCost} Coins`
                  : `Pay ${weeklyTaxCost} Coins`}
            </button>
          </div>

          {worshipTask && (
            <article className="court-feature-card court-grid-card court-grid-card--danger flex min-w-0 flex-col rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-white">{worshipTask.title}</h3>
                <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
                  {worshipTask.status === "approved" ? "Done" : worshipCoolingDown ? "Resting" : "Tribute"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{worshipTask.description}</p>
              <p className="mt-3 text-xs font-bold text-red-100">
                One-way tribute: send coins (min {PET_WORSHIP_MIN_AMOUNT}), no coins back. Reward: +{worshipTask.reward} Pet Score, Devotion scales with the amount sent.
              </p>
              {worshipCoolingDown && (
                <p className="mt-2 text-xs text-yellow-100">
                  Available in {formatRemaining(worshipTask.cooldownUntil ?? null, now)}
                </p>
              )}

              <div className="mt-4 space-y-3 rounded-2xl border border-red-200/15 bg-black/35 p-3">
                {worshipImagePath ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- served from an authenticated API route, not an optimizable static asset */
                  <img
                    alt={`Worship: ${worshipCategory ?? ""}`}
                    className="h-64 w-full select-none rounded-2xl border border-red-200/15 bg-black/40 object-contain"
                    draggable={false}
                    onContextMenu={(event) => event.preventDefault()}
                    src={`/api/user/pet-worship/image?v=${worshipImageVersion}`}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-red-200/15 bg-black/40 text-center text-xs text-red-200/60">
                    Awaiting worship images.
                  </div>
                )}
                {worshipImagePath && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-200/70">
                      {worshipCategory ? `Today: ${worshipCategory}` : "Today's tribute"}
                      {worshipUnlocked && <span className="ml-2 text-emerald-300">· Unlocked</span>}
                    </p>
                    <button
                      className="rounded-full border border-red-200/25 bg-red-600/10 px-3 py-1 text-[11px] font-bold text-red-100 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={disabled || worshipActionPending}
                      onClick={onWorshipDownload}
                      type="button"
                    >
                      {worshipUnlocked ? "Download" : `Download (${PET_WORSHIP_DOWNLOAD_COST} coins)`}
                    </button>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-red-200/60">
                    Tribute amount (min {PET_WORSHIP_MIN_AMOUNT} coins)
                  </p>
                  <input
                    className="w-full rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={worshipLocked}
                    inputMode="numeric"
                    min={PET_WORSHIP_MIN_AMOUNT}
                    onChange={(event) => setWorshipAmountInput(event.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={`Send for my ${worshipCategory ?? "worship"}...`}
                    type="number"
                    value={worshipAmountInput}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-red-200/60">
                    Your worship message
                  </p>
                  <textarea
                    className="w-full resize-none rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={worshipLocked}
                    onChange={(event) => setWorshipComplimentInput(event.target.value)}
                    placeholder={
                      worshipCategory ? getWorshipComplimentPlaceholder(worshipCategory) : "Write your worship line..."
                    }
                    rows={2}
                    value={worshipComplimentInput}
                  />
                </div>
                <button
                  className="w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={
                    worshipLocked ||
                    Number(worshipAmountInput || 0) < PET_WORSHIP_MIN_AMOUNT ||
                    worshipComplimentInput.trim().length === 0
                  }
                  onClick={handleWorshipSubmit}
                  type="button"
                >
                  Send Tribute
                </button>
              </div>
            </article>
          )}
        </div>

        <article className="court-feature-card court-grid-card court-grid-card--danger flex min-w-0 flex-col rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">{throneTask.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{throneTask.description}</p>
            </div>
            <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
              {throneBadgeLabel}
            </span>
          </div>
          <p className="mt-3 text-xs font-bold text-red-100">
            Admin approval adds the selected Throne payout with both bonuses only.
          </p>
          <div className="mt-auto space-y-3 rounded-2xl border border-red-200/15 bg-black/35 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PET_THRONE_AMOUNTS.map((amount) => {
                const active = selectedThroneAmount === amount;

                return (
                  <button
                    className={`flex min-h-12 items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-black leading-none transition ${
                      active
                        ? "border-pink-200/60 bg-pink-500/20 text-pink-50"
                        : "border-white/10 bg-black/35 text-zinc-300 hover:border-pink-200/35 hover:text-pink-50"
                    }`}
                    disabled={disabled || thronePending || throneActionPending}
                    key={amount}
                    onClick={() => setSelectedThroneAmount(amount)}
                    type="button"
                  >
                    {formatPetThroneAmount(amount)}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-pink-200/15 bg-black/30 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-pink-200/70">
                You Receive
              </p>
              <p className="mt-2 text-2xl font-black text-pink-50">
                {formatPetThroneAmount(throneCoinEquivalent)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-pink-100/65">
                Coin equivalent
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Base {throneRewardBreakdown.baseCoinAmount.toLocaleString()} + give bonus {throneRewardBreakdown.giveBonusAmount.toLocaleString()} + task bonus {throneRewardBreakdown.taskBonusAmount.toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Pick the Throne amount, open the Throne page, then upload the gift screen screenshot.
              </p>
            </div>

            <label className="block rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
              <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500">
                Throne screenshot
              </span>
              <input
                accept="image/*"
                className="mt-3 block w-full cursor-pointer text-sm text-zinc-200 file:mr-3 file:rounded-xl file:border-0 file:bg-pink-500/20 file:px-3 file:py-2 file:font-black file:text-pink-50"
                disabled={disabled || throneActionPending}
                onChange={handleThroneProofChange}
                type="file"
              />
              {throneProofError ? (
                <span className="mt-2 block text-xs text-red-300">{throneProofError}</span>
              ) : (
                <span className="mt-2 block text-xs text-zinc-500">
                  Upload the Throne checkout or gift confirmation screen.
                </span>
              )}
            </label>

            {throneProofImage && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                <Image
                  alt="Throne proof preview"
                  className="h-auto w-full"
                  height={960}
                  src={throneProofImage}
                  unoptimized
                  width={720}
                />
              </div>
            )}

            {throneCoolingDown && (
              <p className="text-xs text-yellow-100">
                Available in {formatRemaining(throneTask.cooldownUntil ?? null, now)}
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className={`rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40 ${
                  throneCoolingDown ? CLICKABLE_COOLDOWN_BUTTON_CLASS : ""
                }`}
                disabled={disabled || thronePending || throneActionPending || !throneProofImage}
                onClick={() => {
                  if (throneCoolingDown) {
                    handleCooldownAttempt(`Cooldown active. Available again in ${formatRemaining(throneTask.cooldownUntil ?? null, now)}.`);
                    return;
                  }

                  onSubmitThroneTribute({
                    amount: selectedThroneAmount,
                    proofImage: throneProofImage,
                  });
                }}
                type="button"
              >
                {throneActionPending
                  ? "Submitting..."
                  : thronePending
                    ? "Pending Review"
                    : "Submit Throne Bonus"}
              </button>
              <button
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-zinc-200 transition enabled:hover:border-white/20 enabled:hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || throneActionPending || !throneProofImage}
                onClick={onCancelThroneTribute}
                type="button"
              >
                Clear Screenshot
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
