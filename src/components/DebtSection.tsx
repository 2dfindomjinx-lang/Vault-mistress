"use client";

import { useEffect, useRef, useState } from "react";
import type { PetDebtContract, PetTaskItem } from "@/lib/types";

const DEBT_PET_NAMES = ["Debt Piglet", "Wallet Worm", "Paypig Princess", "Debt Doll", "Tribute Toy", "Debt Addict", "Owned ATM", "Forever Indebted", "Drainlet", "Paywhore", "Cuckie"];
const DEBT_SIGNING_IMAGE_PATH = "/pet/debt-contract-signed.png";
const DEBT_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 1 },
  weekly: { label: "Weeks", max: 52, min: 1 },
};
const DEBT_MINIMUM_PAYMENTS = {
  monthly: 100000,
  weekly: 20000,
};
const DEBT_RANDOM_AMOUNT_STEPS = {
  monthly: 10000,
  weekly: 5000,
};
const EVIL_DEBT_DURATION_MULTIPLIER = 2.5;
const EVIL_CONSENT_PRIMARY_TEXT =
  "I confirm that these images belong to me and I am sharing them with my own consent.";
const EVIL_CONSENT_SECONDARY_TEXT =
  "I consent that Principessa may use these images and I accept the consequences.";
const EVIL_DEBT_TIMEZONE_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const offset = index - 12;
  return `UTC${offset >= 0 ? "+" : ""}${offset}`;
});
const DEBT_RANDOM_AMOUNT_LIMITS = {
  monthly: { max: 200000, min: 50000 },
  weekly: { max: 30000, min: 10000 },
};
const DEBT_RANDOM_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 4 },
  weekly: { label: "Weeks", max: 52, min: 8 },
};

type DebtContractForm = {
  age?: number | string;
  consentPrimary?: boolean;
  consentPrimaryText?: string;
  consentSecondary?: boolean;
  consentSecondaryText?: string;
  contractType?: "normal" | "evil";
  customNote?: string;
  debtAmount: number;
  durationPeriods: number;
  fullName?: string;
  imageUrls?: string[];
  randomGenerated?: boolean;
  periodType: "weekly" | "monthly";
  petName: string;
  timezone?: string;
};

type DebtSectionProps = {
  disabled?: boolean;
  isTimeoutActive?: boolean;
  isDebtAutoPayEnabled: boolean;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onPayDebtPeriod: () => void;
  onSignDebtContract: (form: DebtContractForm) => Promise<boolean> | boolean;
  pendingPetActionIds?: string[];
  petDebtContract: PetDebtContract | null;
  tasks: PetTaskItem[];
};

function getCurrentInstallmentRemaining(contract: PetDebtContract) {
  const currentInstallmentRemaining = Math.floor(Number(contract.current_installment_remaining ?? 0));
  return currentInstallmentRemaining > 0 ? currentInstallmentRemaining : Math.max(0, contract.debt_amount);
}

function getRemainingDebtBalance(contract: PetDebtContract) {
  return getCurrentInstallmentRemaining(contract)
    + Math.max(0, contract.duration_periods - contract.paid_periods - 1) * contract.debt_amount;
}

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

function randomInteger(minimum: number, maximum: number) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function randomPetName() {
  return DEBT_PET_NAMES[Math.floor(Math.random() * DEBT_PET_NAMES.length)] ?? DEBT_PET_NAMES[0];
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function randomWeightedWeeklyDebtDuration(amount: number) {
  const durationLimit = DEBT_RANDOM_DURATION_LIMITS.weekly;
  const amountLimit = DEBT_RANDOM_AMOUNT_LIMITS.weekly;
  const amountRange = amountLimit.max - amountLimit.min;
  const lowAmountBias =
    amountRange > 0 ? Math.max(0, (amountLimit.max - amount) / amountRange) : 0;
  const durationOptions = Array.from(
    { length: durationLimit.max - durationLimit.min + 1 },
    (_, index) => durationLimit.min + index,
  );
  const weightedOptions = durationOptions.map((duration) => {
    const durationRange = durationLimit.max - durationLimit.min;
    const highDurationBias =
      durationRange > 0 ? (duration - durationLimit.min) / durationRange : 0;

    return {
      duration,
      weight: 1 + lowAmountBias * highDurationBias * 5,
    };
  });
  const totalWeight = weightedOptions.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const option of weightedOptions) {
    roll -= option.weight;

    if (roll <= 0) {
      return option.duration;
    }
  }

  return durationLimit.max;
}

function randomDebtPeriodType(): "weekly" | "monthly" {
  return Math.random() < 0.5 ? "weekly" : "monthly";
}

function getRandomDebtDraft(): {
  amount: number;
  duration: number;
  periodType: "weekly" | "monthly";
} {
  const periodType = randomDebtPeriodType();
  const durationLimit = DEBT_RANDOM_DURATION_LIMITS[periodType];
  const amountLimit = DEBT_RANDOM_AMOUNT_LIMITS[periodType];
  const amountStep = DEBT_RANDOM_AMOUNT_STEPS[periodType];
  const minimumMultiplier = amountLimit.min / amountStep;
  const maximumMultiplier = amountLimit.max / amountStep;
  const installmentAmount = randomInteger(minimumMultiplier, maximumMultiplier) * amountStep;
  const duration =
    periodType === "weekly"
      ? randomWeightedWeeklyDebtDuration(installmentAmount)
      : randomInteger(durationLimit.min, durationLimit.max);

  return {
    amount: installmentAmount,
    duration,
    periodType,
  };
}

export function DebtSection({
  disabled = false,
  isTimeoutActive = false,
  isDebtAutoPayEnabled,
  onDebtAutoPayChange,
  onPayDebtPeriod,
  onSignDebtContract,
  pendingPetActionIds = [],
  petDebtContract,
  tasks,
}: DebtSectionProps) {
  const [now, setNow] = useState(0);
  const debtSignTimerRef = useRef<number | null>(null);
  const [normalPetName, setNormalPetName] = useState(DEBT_PET_NAMES[0]);
  const [normalDebtAmount, setNormalDebtAmount] = useState("");
  const [normalDebtDuration, setNormalDebtDuration] = useState("");
  const [normalDebtPeriodType, setNormalDebtPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [evilAge, setEvilAge] = useState("");
  const [evilFullName, setEvilFullName] = useState("");
  const [evilTimezone, setEvilTimezone] = useState("UTC+3");
  const [evilCustomNote, setEvilCustomNote] = useState("");
  const [evilConsentPrimary, setEvilConsentPrimary] = useState("");
  const [evilConsentSecondary, setEvilConsentSecondary] = useState("");
  const [evilImageUrls, setEvilImageUrls] = useState<string[]>([]);
  const [evilImageError, setEvilImageError] = useState("");
  const [evilDebtAmount, setEvilDebtAmount] = useState("");
  const [evilDebtDuration, setEvilDebtDuration] = useState("");
  const [evilDebtPeriodType, setEvilDebtPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [showDebtSigningImage, setShowDebtSigningImage] = useState<"normal" | "evil" | null>(null);

  const isPetActionPending = (actionId: string) => pendingPetActionIds.includes(actionId);
  const debtTask = tasks.find((task) => task.kind === "debt-contract");
  const activeDebtContractType = petDebtContract?.contract_type === "evil" ? "evil" : "normal";
  const hasOpenDebtContract = Boolean(
    petDebtContract && ["active", "pending"].includes(petDebtContract.status),
  );
  const contractControlsDisabled = disabled || isTimeoutActive;
  const activeContract = petDebtContract;
  const blockingContractMessage = hasOpenDebtContract
    ? activeDebtContractType === "evil"
      ? "Evil Debt Contract is active or pending. Normal Debt Contract cannot be signed until it ends."
      : "Normal Debt Contract is active or pending. Evil Debt Contract cannot be signed until it ends."
    : null;
  const contractCreationDisabled = contractControlsDisabled || hasOpenDebtContract;
  const debtPaymentDue = activeContract
    ? activeContract.paid_periods === 0 || new Date(activeContract.next_due_at ?? "").getTime() <= now
    : false;
  const debtInstallmentNumber = activeContract
    ? Math.min(activeContract.paid_periods + 1, activeContract.duration_periods)
    : 0;
  const remainingDebtBalance = activeContract
    ? getRemainingDebtBalance(activeContract)
    : 0;
  const normalDebtDurationLimit = DEBT_DURATION_LIMITS[normalDebtPeriodType];
  const normalDebtMinimumPayment = DEBT_MINIMUM_PAYMENTS[normalDebtPeriodType];
  const evilBaseDurationLimit = DEBT_DURATION_LIMITS[evilDebtPeriodType];
  const evilDebtDurationLimit = {
    ...evilBaseDurationLimit,
    min: Math.ceil(evilBaseDurationLimit.min * EVIL_DEBT_DURATION_MULTIPLIER),
  };
  const evilDebtMinimumPayment = evilDebtPeriodType === "weekly" ? 40000 : 80000;

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(interval);
      if (debtSignTimerRef.current !== null) {
        window.clearTimeout(debtSignTimerRef.current);
      }
    };
  }, []);

  function showSignedImage(kind: "normal" | "evil") {
    setShowDebtSigningImage(kind);
    if (debtSignTimerRef.current !== null) {
      window.clearTimeout(debtSignTimerRef.current);
    }
    debtSignTimerRef.current = window.setTimeout(() => setShowDebtSigningImage(null), 4500);
  }

  async function signDebtContract(form: DebtContractForm) {
    const signed = await onSignDebtContract(form);
    if (signed) {
      showSignedImage(form.contractType === "evil" ? "evil" : "normal");
    }
    return signed;
  }

  async function handleRandomDebtSign() {
    const draft = getRandomDebtDraft();
    const petName = randomPetName();

    setNormalPetName(petName);
    setNormalDebtAmount(String(draft.amount));
    setNormalDebtDuration(String(draft.duration));
    setNormalDebtPeriodType(draft.periodType);
    await signDebtContract({
      contractType: "normal",
      debtAmount: draft.amount,
      durationPeriods: draft.duration,
      randomGenerated: true,
      periodType: draft.periodType,
      petName,
    });
  }

  async function handleNormalDebtSign() {
    await signDebtContract({
      contractType: "normal",
      debtAmount: Number(normalDebtAmount),
      durationPeriods: Number(normalDebtDuration),
      periodType: normalDebtPeriodType,
      petName: normalPetName,
    });
  }

  async function handleEvilDebtImages(files: FileList | null) {
    setEvilImageError("");
    const selectedFiles = Array.from(files ?? []).slice(0, 8);

    if (selectedFiles.length === 0) {
      setEvilImageUrls([]);
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith("image/"))) {
      setEvilImageError("Only image files are accepted.");
      return;
    }

    if (selectedFiles.some((file) => file.size > 1_000_000)) {
      setEvilImageError("Each image must be 1MB or smaller.");
      return;
    }

    try {
      setEvilImageUrls(await Promise.all(selectedFiles.map(fileToDataUrl)));
    } catch {
      setEvilImageError("Images failed to load.");
    }
  }

  async function handleEvilDebtSign() {
    if (!window.confirm("Are you absolutely sure you want to sign the Evil Debt Contract?")) {
      return;
    }

    await signDebtContract({
      age: evilAge,
      consentPrimary: evilConsentPrimary.trim() === EVIL_CONSENT_PRIMARY_TEXT,
      consentPrimaryText: evilConsentPrimary.trim(),
      consentSecondary: evilConsentSecondary.trim() === EVIL_CONSENT_SECONDARY_TEXT,
      consentSecondaryText: evilConsentSecondary.trim(),
      contractType: "evil",
      customNote: evilCustomNote,
      debtAmount: Number(evilDebtAmount),
      durationPeriods: Number(evilDebtDuration),
      fullName: evilFullName,
      imageUrls: evilImageUrls,
      periodType: evilDebtPeriodType,
      petName: "Evil Debt Contract",
      timezone: evilTimezone,
    });
  }

  if (!debtTask) {
    return null;
  }

  return (
    <section className="grid min-w-0 gap-6 xl:grid-cols-2">
      <DebtCard
        active={activeDebtContractType === "normal"}
        currentKind={showDebtSigningImage}
        debtInstallmentNumber={debtInstallmentNumber}
        debtPaymentDue={debtPaymentDue}
        debtTask={debtTask}
        disabled={disabled}
        blockingContractMessage={blockingContractMessage}
        hasOpenDebtContract={hasOpenDebtContract}
        isDebtAutoPayEnabled={isDebtAutoPayEnabled}
        isPetActionPending={isPetActionPending}
        isTimeoutActive={isTimeoutActive}
        kind="normal"
        normalDebtDuration={normalDebtDuration}
        normalDebtDurationLimit={normalDebtDurationLimit}
        normalDebtMinimumPayment={normalDebtMinimumPayment}
        normalDebtPeriodType={normalDebtPeriodType}
        normalDebtAmount={normalDebtAmount}
        normalPetName={normalPetName}
        onDebtAutoPayChange={onDebtAutoPayChange}
        onNormalDebtAmountChange={setNormalDebtAmount}
        onNormalDebtDurationChange={setNormalDebtDuration}
        onNormalDebtPeriodTypeChange={setNormalDebtPeriodType}
        onNormalPetNameChange={setNormalPetName}
        onPayDebtPeriod={onPayDebtPeriod}
        onRandomDebtSign={handleRandomDebtSign}
        onSign={handleNormalDebtSign}
        petDebtContract={petDebtContract}
        remainingDebtBalance={remainingDebtBalance}
        now={now}
      />
      <EvilDebtCard
        active={activeDebtContractType === "evil"}
        currentKind={showDebtSigningImage}
        debtInstallmentNumber={debtInstallmentNumber}
        debtPaymentDue={debtPaymentDue}
        disabled={disabled}
        blockingContractMessage={blockingContractMessage}
        evilAge={evilAge}
        evilConsentPrimary={evilConsentPrimary}
        evilConsentSecondary={evilConsentSecondary}
        evilCustomNote={evilCustomNote}
        evilDebtAmount={evilDebtAmount}
        evilDebtDuration={evilDebtDuration}
        evilDebtDurationLimit={evilDebtDurationLimit}
        evilDebtMinimumPayment={evilDebtMinimumPayment}
        evilDebtPeriodType={evilDebtPeriodType}
        evilFullName={evilFullName}
        evilImageError={evilImageError}
        evilImageUrls={evilImageUrls}
        evilTimezone={evilTimezone}
        hasOpenDebtContract={hasOpenDebtContract}
        isDebtAutoPayEnabled={isDebtAutoPayEnabled}
        isPetActionPending={isPetActionPending}
        isTimeoutActive={isTimeoutActive}
        onDebtAutoPayChange={onDebtAutoPayChange}
        onEvilAgeChange={setEvilAge}
        onEvilConsentPrimaryChange={setEvilConsentPrimary}
        onEvilConsentSecondaryChange={setEvilConsentSecondary}
        onEvilCustomNoteChange={setEvilCustomNote}
        onEvilDebtAmountChange={setEvilDebtAmount}
        onEvilDebtDurationChange={setEvilDebtDuration}
        onEvilDebtImagesChange={handleEvilDebtImages}
        onEvilDebtPeriodTypeChange={setEvilDebtPeriodType}
        onEvilFullNameChange={setEvilFullName}
        onEvilTimezoneChange={setEvilTimezone}
        onPayDebtPeriod={onPayDebtPeriod}
        onSign={handleEvilDebtSign}
        petDebtContract={petDebtContract}
        remainingDebtBalance={remainingDebtBalance}
        now={now}
      />
    </section>
  );
}

function DebtCard(props: {
  active: boolean;
  currentKind: "normal" | "evil" | null;
  debtInstallmentNumber: number;
  debtPaymentDue: boolean;
  debtTask: PetTaskItem;
  disabled: boolean;
  blockingContractMessage: string | null;
  hasOpenDebtContract: boolean;
  isDebtAutoPayEnabled: boolean;
  isPetActionPending: (actionId: string) => boolean;
  isTimeoutActive: boolean;
  kind: "normal";
  normalDebtAmount: string;
  normalDebtDuration: string;
  normalDebtDurationLimit: { label: string; max: number; min: number };
  normalDebtMinimumPayment: number;
  normalDebtPeriodType: "weekly" | "monthly";
  normalPetName: string;
  now: number;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onNormalDebtAmountChange: (value: string) => void;
  onNormalDebtDurationChange: (value: string) => void;
  onNormalDebtPeriodTypeChange: (value: "weekly" | "monthly") => void;
  onNormalPetNameChange: (value: string) => void;
  onPayDebtPeriod: () => void;
  onRandomDebtSign: () => void;
  onSign: () => void;
  petDebtContract: PetDebtContract | null;
  remainingDebtBalance: number;
}) {
  const {
    active,
    currentKind,
    debtInstallmentNumber,
    debtPaymentDue,
    debtTask,
    disabled,
    blockingContractMessage,
    hasOpenDebtContract,
    isDebtAutoPayEnabled,
    isPetActionPending,
    isTimeoutActive,
    normalDebtAmount,
    normalDebtDuration,
    normalDebtDurationLimit,
    normalDebtMinimumPayment,
    normalDebtPeriodType,
    normalPetName,
    now,
    onDebtAutoPayChange,
    onNormalDebtAmountChange,
    onNormalDebtDurationChange,
    onNormalDebtPeriodTypeChange,
    onNormalPetNameChange,
    onPayDebtPeriod,
    onRandomDebtSign,
    onSign,
    petDebtContract,
    remainingDebtBalance,
  } = props;

  const showLockedState = hasOpenDebtContract && !active && petDebtContract;
  const contractControlsDisabled = disabled || isTimeoutActive;
  const contractCreationDisabled = contractControlsDisabled || hasOpenDebtContract;

  return (
    <article className="rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-red-200/70">Debt</p>
          <h3 className="mt-1 text-lg font-black text-white">Normal Debt Contract</h3>
        </div>
        <span className="rounded-full border border-red-200/20 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-50">
          Contract
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{debtTask.description}</p>
      {currentKind === "normal" && (
        <SignedBanner />
      )}
      {hasOpenDebtContract && active && petDebtContract ? (
        <div className="mt-4 rounded-2xl border border-red-200/15 bg-black/35 p-3">
          <div className="grid gap-2 text-sm text-red-50 sm:grid-cols-2">
            <span>Pet: {petDebtContract.pet_name}</span>
            <span>{petDebtContract.period_type} debt</span>
            <span>
              Installment: {debtInstallmentNumber}/{petDebtContract.duration_periods}
            </span>
            <span>Current payment: {getCurrentInstallmentRemaining(petDebtContract).toLocaleString()} Coins</span>
            <span>
              Next availability: {debtPaymentDue ? "Open now" : formatRemaining(petDebtContract.next_due_at, now)}
            </span>
            <span>Remaining balance: {remainingDebtBalance.toLocaleString()} Coins</span>
            <span>Paid periods: {petDebtContract.paid_periods}</span>
            <span>Missed: {petDebtContract.missed_periods}</span>
          </div>
          <p className="mt-3 rounded-2xl border border-red-200/10 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50/80">
            Future installments are locked. Only the current {petDebtContract.period_type === "weekly" ? "week" : "month"} can be paid.
          </p>
          <div className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-3 text-xs font-bold text-yellow-50/85">
            <AutoPaymentSwitch
              disabled={contractControlsDisabled}
              enabled={isDebtAutoPayEnabled}
              onChange={onDebtAutoPayChange}
            />
            <p className="mt-2 text-yellow-50/75">
              When enabled, each installment is paid automatically as soon as it becomes available.
            </p>
            <p className="mt-2 text-yellow-50/75">
              If the account cannot cover the full installment, it now pays only the available coins and keeps the remaining debt due.
            </p>
          </div>
          <button
            className="mt-4 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || !debtPaymentDue || isPetActionPending("pet-debt-contract")}
            onClick={onPayDebtPeriod}
            type="button"
          >
            {isPetActionPending("pet-debt-contract")
              ? "Saving..."
              : !debtPaymentDue
                ? "Next installment locked"
                : `Pay installment ${debtInstallmentNumber}`}
          </button>
        </div>
      ) : showLockedState ? (
        <LockedDebtState
          accent="normal"
          blockingContractMessage={blockingContractMessage}
          petDebtContract={petDebtContract}
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {hasOpenDebtContract && (
            <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
              {blockingContractMessage ?? "A debt contract is already active or pending. Only one debt mode can stay open at a time."}
            </p>
          )}
          <select
            className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-red-200/55"
            onChange={(event) => onNormalPetNameChange(event.target.value)}
            value={normalPetName}
            disabled={contractCreationDisabled}
          >
            {DEBT_PET_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="rounded-2xl border border-red-200/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50">
            Minimum Payment: {normalDebtMinimumPayment.toLocaleString()} Coins per {normalDebtPeriodType === "weekly" ? "Week" : "Month"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => onNormalDebtPeriodTypeChange(event.target.value as "weekly" | "monthly")}
              value={normalDebtPeriodType}
              disabled={contractCreationDisabled}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              inputMode="numeric"
              min={normalDebtMinimumPayment}
              onChange={(event) => onNormalDebtAmountChange(event.target.value)}
              placeholder={`Min ${normalDebtMinimumPayment.toLocaleString()}`}
              value={normalDebtAmount}
              disabled={contractCreationDisabled}
            />
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              inputMode="numeric"
              max={normalDebtDurationLimit.max}
              min={normalDebtDurationLimit.min}
              onChange={(event) => onNormalDebtDurationChange(event.target.value)}
              placeholder={`${normalDebtDurationLimit.label} ${normalDebtDurationLimit.min}-${normalDebtDurationLimit.max}`}
              value={normalDebtDuration}
              disabled={contractCreationDisabled}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Duration must be {normalDebtDurationLimit.min}-{normalDebtDurationLimit.max} {normalDebtDurationLimit.label.toLowerCase()} for {normalDebtPeriodType} contracts.
          </p>
          <button
            className="rounded-2xl border border-red-200/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-red-50 transition enabled:hover:border-red-200/50 enabled:hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={contractCreationDisabled || isPetActionPending("pet-debt-contract")}
            onClick={onRandomDebtSign}
            type="button"
          >
            {isPetActionPending("pet-debt-contract") ? "Signing..." : "Sign Random Debt"}
          </button>
          <p className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-2 text-xs font-bold text-red-50/75">
            Warning: Sign Random Debt immediately creates a debt contract with a random Pet name, weekly/monthly type, amount, and duration.
          </p>
          <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
            Auto payment is off by default. Overdue debt can no longer push balance below zero; it only takes what is available and leaves the rest due.
          </p>
          <div className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-3 text-xs font-bold text-red-50/85">
            <AutoPaymentSwitch
              disabled={contractControlsDisabled || hasOpenDebtContract}
              enabled={isDebtAutoPayEnabled}
              onChange={onDebtAutoPayChange}
            />
          </div>
          <button
            className="rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition hover:border-red-200/55 hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={contractCreationDisabled}
            onClick={onSign}
            type="button"
          >
            Sign Debt Contract
          </button>
        </div>
      )}
    </article>
  );
}

function EvilDebtCard(props: {
  active: boolean;
  currentKind: "normal" | "evil" | null;
  debtInstallmentNumber: number;
  debtPaymentDue: boolean;
  disabled: boolean;
  blockingContractMessage: string | null;
  evilAge: string;
  evilConsentPrimary: string;
  evilConsentSecondary: string;
  evilCustomNote: string;
  evilDebtAmount: string;
  evilDebtDuration: string;
  evilDebtDurationLimit: { label: string; max: number; min: number };
  evilDebtMinimumPayment: number;
  evilDebtPeriodType: "weekly" | "monthly";
  evilFullName: string;
  evilImageError: string;
  evilImageUrls: string[];
  evilTimezone: string;
  hasOpenDebtContract: boolean;
  isDebtAutoPayEnabled: boolean;
  isPetActionPending: (actionId: string) => boolean;
  isTimeoutActive: boolean;
  now: number;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onEvilAgeChange: (value: string) => void;
  onEvilConsentPrimaryChange: (value: string) => void;
  onEvilConsentSecondaryChange: (value: string) => void;
  onEvilCustomNoteChange: (value: string) => void;
  onEvilDebtAmountChange: (value: string) => void;
  onEvilDebtDurationChange: (value: string) => void;
  onEvilDebtImagesChange: (files: FileList | null) => Promise<void>;
  onEvilDebtPeriodTypeChange: (value: "weekly" | "monthly") => void;
  onEvilFullNameChange: (value: string) => void;
  onEvilTimezoneChange: (value: string) => void;
  onPayDebtPeriod: () => void;
  onSign: () => void;
  petDebtContract: PetDebtContract | null;
  remainingDebtBalance: number;
}) {
  const {
    active,
    currentKind,
    debtInstallmentNumber,
    debtPaymentDue,
    disabled,
    blockingContractMessage,
    evilAge,
    evilConsentPrimary,
    evilConsentSecondary,
    evilCustomNote,
    evilDebtAmount,
    evilDebtDuration,
    evilDebtDurationLimit,
    evilDebtMinimumPayment,
    evilDebtPeriodType,
    evilFullName,
    evilImageError,
    evilImageUrls,
    evilTimezone,
    hasOpenDebtContract,
    isDebtAutoPayEnabled,
    isPetActionPending,
    isTimeoutActive,
    now,
    onDebtAutoPayChange,
    onEvilAgeChange,
    onEvilConsentPrimaryChange,
    onEvilConsentSecondaryChange,
    onEvilCustomNoteChange,
    onEvilDebtAmountChange,
    onEvilDebtDurationChange,
    onEvilDebtImagesChange,
    onEvilDebtPeriodTypeChange,
    onEvilFullNameChange,
    onEvilTimezoneChange,
    onPayDebtPeriod,
    onSign,
    petDebtContract,
    remainingDebtBalance,
  } = props;

  const showLockedState = hasOpenDebtContract && !active && petDebtContract;
  const contractControlsDisabled = disabled || isTimeoutActive;
  const contractCreationDisabled = contractControlsDisabled || hasOpenDebtContract;

  return (
    <article className="rounded-[1.5rem] border border-red-500/25 bg-[linear-gradient(180deg,rgba(69,10,10,0.5),rgba(0,0,0,0.8))] p-4 shadow-[0_0_28px_rgba(127,29,29,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-red-200/70">Debt</p>
          <h3 className="mt-1 text-lg font-black text-white">Evil Debt Contract</h3>
        </div>
        <span className="rounded-full border border-red-200/25 bg-red-700/30 px-2 py-1 text-[10px] font-black uppercase text-red-50">
          Evil
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Submit the stricter contract flow separately. This mode stays mutually exclusive with the normal debt contract.
      </p>
      {currentKind === "evil" && (
        <SignedBanner />
      )}
      {hasOpenDebtContract && active && petDebtContract ? (
        <div className="mt-4 rounded-2xl border border-red-200/15 bg-black/35 p-3">
          <div className="grid gap-2 text-sm text-red-50 sm:grid-cols-2">
            <span>Contract: {petDebtContract.pet_name}</span>
            <span>{petDebtContract.period_type} debt</span>
            <span>Full name: {petDebtContract.full_name ?? "Stored"}</span>
            <span>Timezone: {petDebtContract.timezone ?? "Stored"}</span>
            <span>
              Installment: {debtInstallmentNumber}/{petDebtContract.duration_periods}
            </span>
            <span>Current payment: {getCurrentInstallmentRemaining(petDebtContract).toLocaleString()} Coins</span>
            <span>
              Next availability: {debtPaymentDue ? "Open now" : formatRemaining(petDebtContract.next_due_at, now)}
            </span>
            <span>Remaining balance: {remainingDebtBalance.toLocaleString()} Coins</span>
            <span>Paid periods: {petDebtContract.paid_periods}</span>
            <span>Missed: {petDebtContract.missed_periods}</span>
            {petDebtContract.status === "pending" && (
              <span className="sm:col-span-2">Status: Pending admin approval</span>
            )}
          </div>
          {petDebtContract.status === "active" ? (
            <>
              <div className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-3 text-xs font-bold text-yellow-50/85">
                <AutoPaymentSwitch
                  disabled={contractControlsDisabled}
                  enabled={isDebtAutoPayEnabled}
                  onChange={onDebtAutoPayChange}
                />
                <p className="mt-2 text-yellow-50/75">
                  When enabled, each installment is paid automatically as soon as it becomes available.
                </p>
              </div>
              <button
                className="mt-4 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || !debtPaymentDue || isPetActionPending("pet-debt-contract")}
                onClick={onPayDebtPeriod}
                type="button"
              >
                {isPetActionPending("pet-debt-contract")
                  ? "Saving..."
                  : !debtPaymentDue
                    ? "Next installment locked"
                    : `Pay installment ${debtInstallmentNumber}`}
              </button>
            </>
          ) : (
            <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
              Evil Debt Contract was submitted and is waiting for admin approval.
            </p>
          )}
        </div>
      ) : showLockedState ? (
        <LockedDebtState
          accent="evil"
          blockingContractMessage={blockingContractMessage}
          petDebtContract={petDebtContract}
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {hasOpenDebtContract && (
            <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
              {blockingContractMessage ?? "A debt contract is already active or pending. Only one debt mode can stay open at a time."}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => onEvilFullNameChange(event.target.value)}
              placeholder="Full name"
              value={evilFullName}
              disabled={contractCreationDisabled}
            />
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              inputMode="numeric"
              onChange={(event) => onEvilAgeChange(event.target.value)}
              placeholder="Age"
              type="number"
              value={evilAge}
              disabled={contractCreationDisabled}
            />
            <select
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => onEvilTimezoneChange(event.target.value)}
              value={evilTimezone}
              disabled={contractCreationDisabled}
            >
              {EVIL_DEBT_TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="min-h-24 rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            maxLength={240}
            onChange={(event) => onEvilCustomNoteChange(event.target.value)}
            placeholder="Optional note"
            value={evilCustomNote}
            disabled={contractCreationDisabled}
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Optional note, max 240 characters.
          </p>
          <p className="rounded-2xl border border-red-200/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50">
            Evil minimum: {evilDebtMinimumPayment.toLocaleString()} Coins per {evilDebtPeriodType === "weekly" ? "Week" : "Month"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => onEvilDebtPeriodTypeChange(event.target.value as "weekly" | "monthly")}
              value={evilDebtPeriodType}
              disabled={contractCreationDisabled}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              inputMode="numeric"
              min={evilDebtMinimumPayment}
              onChange={(event) => onEvilDebtAmountChange(event.target.value)}
              placeholder={`Min ${evilDebtMinimumPayment.toLocaleString()}`}
              step={5000}
              value={evilDebtAmount}
              disabled={contractCreationDisabled}
            />
            <input
              className="rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              inputMode="numeric"
              max={evilDebtDurationLimit.max}
              min={evilDebtDurationLimit.min}
              onChange={(event) => onEvilDebtDurationChange(event.target.value)}
              placeholder={`${evilDebtDurationLimit.label} ${evilDebtDurationLimit.min}-${evilDebtDurationLimit.max}`}
              value={evilDebtDuration}
              disabled={contractCreationDisabled}
            />
          </div>
          <label className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-3 text-xs font-bold text-red-50/85">
            Upload 1-8 BM images
            <input
              accept="image/*"
              className="mt-2 block w-full text-xs text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-red-500/20 file:px-3 file:py-2 file:text-xs file:font-bold file:text-red-50"
              multiple
              onChange={(event) => void onEvilDebtImagesChange(event.target.files)}
              type="file"
              disabled={contractCreationDisabled}
            />
          </label>
          {evilImageError && (
            <p className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-100">
              {evilImageError}
            </p>
          )}
          {evilImageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {evilImageUrls.map((imageUrl, index) => (
                <img
                  alt={`Evil Debt upload ${index + 1}`}
                  className="aspect-square rounded-xl border border-red-200/15 object-cover"
                  key={`${imageUrl.slice(0, 32)}-${index}`}
                  src={imageUrl}
                />
              ))}
            </div>
          )}
          <textarea
            className="min-h-20 rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            onChange={(event) => onEvilConsentPrimaryChange(event.target.value)}
            placeholder={EVIL_CONSENT_PRIMARY_TEXT}
            value={evilConsentPrimary}
            disabled={contractCreationDisabled}
          />
          <p className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-2 text-[11px] font-bold text-red-50/80">
            Consent 1 must be typed exactly: {EVIL_CONSENT_PRIMARY_TEXT}
          </p>
          <textarea
            className="min-h-20 rounded-2xl border border-red-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            onChange={(event) => onEvilConsentSecondaryChange(event.target.value)}
            placeholder={EVIL_CONSENT_SECONDARY_TEXT}
            value={evilConsentSecondary}
            disabled={contractCreationDisabled}
          />
          <p className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-2 text-[11px] font-bold text-red-50/80">
            Consent 2 must be typed exactly: {EVIL_CONSENT_SECONDARY_TEXT}
          </p>
          <p className="rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/80">
            Evil Debt Contract is mutually exclusive with normal Debt Contract. Final signing asks one last confirmation.
          </p>
          <div className="rounded-2xl border border-red-200/15 bg-black/35 px-3 py-3 text-xs font-bold text-red-50/85">
            <AutoPaymentSwitch
              disabled={contractControlsDisabled || hasOpenDebtContract}
              enabled={isDebtAutoPayEnabled}
              onChange={onDebtAutoPayChange}
            />
          </div>
          <button
            className="rounded-2xl border border-red-200/25 bg-red-700/25 px-4 py-3 text-sm font-black text-red-50 transition hover:border-red-200/55 hover:bg-red-700/35 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onSign}
            type="button"
            disabled={contractCreationDisabled}
          >
            Sign Evil Debt Contract
          </button>
        </div>
      )}
    </article>
  );
}

function LockedDebtState({
  accent,
  blockingContractMessage,
  petDebtContract,
}: {
  accent: "normal" | "evil";
  blockingContractMessage: string | null;
  petDebtContract: PetDebtContract;
}) {
  const pillClass =
    accent === "evil"
      ? "border-red-300/25 bg-red-700/25 text-red-50"
      : "border-yellow-200/20 bg-yellow-500/10 text-yellow-50";

  return (
    <div className="mt-4 rounded-2xl border border-red-200/15 bg-black/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">New Contract Locked</p>
          <p className="mt-1 text-xs text-zinc-400">
            {blockingContractMessage ?? "Another debt contract is already active or pending."}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${pillClass}`}>
          Locked
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-red-50 sm:grid-cols-2">
        <span>Active mode: {petDebtContract.contract_type === "evil" ? "Evil Debt Contract" : "Normal Debt Contract"}</span>
        <span>Status: {petDebtContract.status}</span>
        <span>{petDebtContract.period_type === "weekly" ? "Weekly" : "Monthly"} schedule</span>
        <span>Payment: {petDebtContract.debt_amount.toLocaleString()} Coins</span>
      </div>
      <p className="mt-3 rounded-2xl border border-red-200/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50/80">
        You cannot create a new debt contract until the current one is completed, removed, or resolved by admin.
      </p>
    </div>
  );
}

function SignedBanner() {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-red-200/25 bg-black/45 shadow-[0_0_28px_rgba(248,113,113,0.18)]">
      <div
        className="flex min-h-28 items-center justify-center bg-cover bg-center px-4 py-8 text-center"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.82), rgba(127,29,29,0.28)), url(${DEBT_SIGNING_IMAGE_PATH})` }}
      >
        <p className="text-sm font-black uppercase tracking-[0.24em] text-red-50">
          Contract signed
        </p>
      </div>
    </div>
  );
}

function AutoPaymentSwitch({
  disabled = false,
  enabled,
  onChange,
}: {
  disabled?: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center gap-3 text-left"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      type="button"
    >
      <span className="min-w-0 flex-1">Auto payment</span>
      <span className="ml-auto inline-flex items-center gap-2">
        <span
          className={`relative h-7 w-14 rounded-full border transition ${
            enabled
              ? "border-emerald-200/40 bg-emerald-400/25"
              : "border-red-200/25 bg-black/55"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full transition ${
              enabled
                ? "left-7 bg-emerald-100 shadow-[0_0_14px_rgba(110,231,183,0.55)]"
                : "left-1 bg-red-100/80"
            }`}
          />
        </span>
        <span className={enabled ? "text-emerald-100" : "text-red-100/80"}>
          {enabled ? "ON" : "OFF"}
        </span>
      </span>
    </button>
  );
}
