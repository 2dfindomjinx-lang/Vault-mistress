"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateThroneDebtPlan,
  getThroneDebtMinimumInstallmentUsd,
  getThroneDebtPaidTotal,
  THRONE_DEBT_LENGTH_OPTIONS,
  type ThroneDebtContract,
  type ThroneDebtFrequency,
} from "@/lib/throne-debt";
import type { PetDebtContract, PetTaskItem } from "@/lib/types";
import { useDeadlineClock } from "@/hooks/useDeadlineClock";

const DEBT_PET_NAMES = ["Debt Piglet", "Wallet Worm", "Paypig Princess", "Debt Doll", "Tribute Toy", "Debt Addict", "Owned ATM", "Forever Indebted", "Drainlet", "Paywhore", "Cuckie"];
const DEBT_SIGNING_IMAGE_PATH = "/pet/debt-contract-signed.png";
const DEBT_DURATION_LIMITS = {
  monthly: { label: "Months", max: 24, min: 1 },
  weekly: { label: "Weeks", max: 52, min: 1 },
};
const DEBT_MINIMUM_PAYMENTS = {
  monthly: 50000,
  weekly: 10000,
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
const EVIL_DEBT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
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
  purchasePledge?: boolean;
  timezone?: string;
};

type DebtCapacityPreview = {
  balanceCoins: number;
  balanceComponent: number;
  baseTotalLimit: number;
  evaluatedPeriods: number;
  purchasePledgeBoost: number;
  reliablePeriodIncome: number;
  totalLimit: number;
};

type DebtSectionProps = {
  canManageActiveDebtWhileTimedOut?: boolean;
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

function hasMissedDebtInstallment(contract: PetDebtContract | null, now: number) {
  if (!contract || contract.status !== "active") {
    return false;
  }

  const currentInstallmentNumber = Math.min(contract.paid_periods + 1, contract.duration_periods);
  void now;
  return contract.missed_periods >= currentInstallmentNumber;
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

function useDebtCapacityPreview(
  durationValue: string,
  periodType: "weekly" | "monthly",
  purchasePledge: boolean,
) {
  const [capacity, setCapacity] = useState<DebtCapacityPreview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const durationPeriods = Math.floor(Number(durationValue));
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!Number.isInteger(durationPeriods) || durationPeriods < 1) {
        setCapacity(null);
        setError("");
        return;
      }

      void fetch("/api/user/debt-contracts", {
        body: JSON.stringify({
          action: "capacity",
          durationPeriods,
          periodType,
          purchasePledge,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      }).then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          capacity?: DebtCapacityPreview;
          error?: string;
        };

        if (!response.ok || !payload.capacity) {
          throw new Error(payload.error ?? "Debt capacity could not be calculated.");
        }

        setCapacity(payload.capacity);
        setError("");
      }).catch((capacityError) => {
        if (controller.signal.aborted) {
          return;
        }

        setCapacity(null);
        setError(capacityError instanceof Error ? capacityError.message : "Debt capacity could not be calculated.");
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [durationValue, periodType, purchasePledge]);

  return { capacity, error };
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
  canManageActiveDebtWhileTimedOut = false,
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
  const now = useDeadlineClock(
    [petDebtContract?.next_due_at, ...tasks.map((task) => task.cooldownUntil)],
    60_000,
  );
  const debtSignTimerRef = useRef<number | null>(null);
  const [normalPetName, setNormalPetName] = useState(DEBT_PET_NAMES[0]);
  const [normalDebtAmount, setNormalDebtAmount] = useState("");
  const [normalDebtDuration, setNormalDebtDuration] = useState("");
  const [normalDebtPeriodType, setNormalDebtPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [normalPurchasePledge, setNormalPurchasePledge] = useState(false);
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
  const [evilPurchasePledge, setEvilPurchasePledge] = useState(false);
  const [showDebtSigningImage, setShowDebtSigningImage] = useState<"normal" | "evil" | null>(null);

  const isPetActionPending = (actionId: string) => pendingPetActionIds.includes(actionId);
  const debtTask = tasks.find((task) => task.kind === "debt-contract");
  const activeDebtContractType = petDebtContract?.contract_type === "evil" ? "evil" : "normal";
  const hasOpenDebtContract = Boolean(
    petDebtContract && ["active", "pending"].includes(petDebtContract.status),
  );
  const activeContract = petDebtContract;
  const blockingContractMessage = hasOpenDebtContract
    ? activeDebtContractType === "evil"
      ? "Evil Debt Contract is active or pending. Normal Debt Contract cannot be signed until it ends."
      : "Normal Debt Contract is active or pending. Evil Debt Contract cannot be signed until it ends."
    : null;
  const debtPaymentDue = activeContract
    ? new Date(activeContract.next_due_at ?? "").getTime() <= now
    : false;
  const hasMissedInstallment = hasMissedDebtInstallment(activeContract, now);
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
  const normalCapacityPreview = useDebtCapacityPreview(
    normalDebtDuration,
    normalDebtPeriodType,
    normalPurchasePledge,
  );
  const evilCapacityPreview = useDebtCapacityPreview(
    evilDebtDuration,
    evilDebtPeriodType,
    evilPurchasePledge,
  );

  useEffect(() => () => {
    if (debtSignTimerRef.current !== null) {
      window.clearTimeout(debtSignTimerRef.current);
    }
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
      purchasePledge: normalPurchasePledge,
    });
  }

  async function handleNormalDebtSign() {
    await signDebtContract({
      contractType: "normal",
      debtAmount: Number(normalDebtAmount),
      durationPeriods: Number(normalDebtDuration),
      periodType: normalDebtPeriodType,
      petName: normalPetName,
      purchasePledge: normalPurchasePledge,
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

    if (selectedFiles.some((file) => file.size > EVIL_DEBT_IMAGE_MAX_BYTES)) {
      setEvilImageError("Each image must be 4MB or smaller.");
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
      purchasePledge: evilPurchasePledge,
      timezone: evilTimezone,
    });
  }

  if (!debtTask) {
    return null;
  }

  return (
    <section className="court-grid court-grid--debt grid min-w-0 gap-6 xl:grid-cols-3">
      <DebtCard
        active={activeDebtContractType === "normal"}
        currentKind={showDebtSigningImage}
        debtInstallmentNumber={debtInstallmentNumber}
        hasMissedInstallment={hasMissedInstallment}
        debtPaymentDue={debtPaymentDue}
        debtTask={debtTask}
        canManageActiveDebtWhileTimedOut={canManageActiveDebtWhileTimedOut}
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
        normalPurchasePledge={normalPurchasePledge}
        capacityPreview={normalCapacityPreview.capacity}
        capacityPreviewError={normalCapacityPreview.error}
        normalDebtAmount={normalDebtAmount}
        normalPetName={normalPetName}
        onDebtAutoPayChange={onDebtAutoPayChange}
        onNormalDebtAmountChange={setNormalDebtAmount}
        onNormalDebtDurationChange={setNormalDebtDuration}
        onNormalDebtPeriodTypeChange={setNormalDebtPeriodType}
        onNormalPetNameChange={setNormalPetName}
        onNormalPurchasePledgeChange={setNormalPurchasePledge}
        onPayDebtPeriod={onPayDebtPeriod}
        onRandomDebtSign={handleRandomDebtSign}
        onSign={handleNormalDebtSign}
        petDebtContract={petDebtContract}
        remainingDebtBalance={remainingDebtBalance}
        now={now}
      />
      <EvilDebtCard
        active={activeDebtContractType === "evil"}
        canManageActiveDebtWhileTimedOut={canManageActiveDebtWhileTimedOut}
        currentKind={showDebtSigningImage}
        debtInstallmentNumber={debtInstallmentNumber}
        hasMissedInstallment={hasMissedInstallment}
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
        evilPurchasePledge={evilPurchasePledge}
        capacityPreview={evilCapacityPreview.capacity}
        capacityPreviewError={evilCapacityPreview.error}
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
        onEvilPurchasePledgeChange={setEvilPurchasePledge}
        onEvilTimezoneChange={setEvilTimezone}
        onPayDebtPeriod={onPayDebtPeriod}
        onSign={handleEvilDebtSign}
        petDebtContract={petDebtContract}
        remainingDebtBalance={remainingDebtBalance}
        now={now}
      />
      <ThroneDebtCard disabled={disabled} isTimeoutActive={isTimeoutActive} />
    </section>
  );
}

function ThroneDebtCard({
  disabled = false,
  isTimeoutActive = false,
}: {
  disabled?: boolean;
  isTimeoutActive?: boolean;
}) {
  const [contracts, setContracts] = useState<ThroneDebtContract[]>([]);
  const [totalAmountUsd, setTotalAmountUsd] = useState("");
  const [repaymentFrequency, setRepaymentFrequency] = useState<ThroneDebtFrequency>("weekly");
  const [contractLengthWeeks, setContractLengthWeeks] = useState("");
  const [customLengthWeeks, setCustomLengthWeeks] = useState("");
  const [userNote, setUserNote] = useState("");
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  const [throneOrderLink, setThroneOrderLink] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const activeContract = contracts.find((contract) =>
    ["pending_review", "active", "overdue", "timeout", "paused"].includes(contract.status),
  ) ?? null;
  const cleanLengthWeeks = contractLengthWeeks === "custom"
    ? Math.floor(Number(customLengthWeeks))
    : Math.floor(Number(contractLengthWeeks));
  const hasPlanInputs =
    totalAmountUsd.trim() !== "" &&
    contractLengthWeeks.trim() !== "" &&
    (contractLengthWeeks !== "custom" || customLengthWeeks.trim() !== "");
  const plan = calculateThroneDebtPlan({
    contractLengthWeeks: hasPlanInputs && Number.isFinite(cleanLengthWeeks) ? cleanLengthWeeks : 4,
    repaymentFrequency,
    totalAmountUsd: hasPlanInputs ? Number(totalAmountUsd) : 0,
  });
  const minimumInstallmentUsd = getThroneDebtMinimumInstallmentUsd(repaymentFrequency);
  const planValid =
    hasPlanInputs &&
    Number.isFinite(Number(totalAmountUsd)) &&
    Number(totalAmountUsd) > 0 &&
    Number.isInteger(cleanLengthWeeks) &&
    cleanLengthWeeks >= 4 &&
    plan.installmentAmountUsd >= minimumInstallmentUsd;
  const paidUsd = activeContract ? getThroneDebtPaidTotal(activeContract) : 0;
  const remainingUsd = activeContract ? Math.max(0, activeContract.total_amount_usd - paidUsd) : 0;
  const installments = activeContract?.installments ?? [];
  const nextInstallment = installments.find((installment) =>
    ["pending", "rejected", "overdue", "timeout_redemption_required"].includes(installment.status),
  ) ?? null;
  const selectedInstallment = installments.find((installment) => installment.id === selectedInstallmentId)
    ?? nextInstallment
    ?? null;

  const loadThroneDebts = async () => {
    try {
      const response = await fetch("/api/user/throne-debts", { cache: "no-store" });
      const payload = (await response.json()) as {
        contracts?: ThroneDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Throne Debt could not be loaded.");
      }

      setContracts(payload.contracts ?? []);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Throne Debt could not be loaded.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadThroneDebts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const createThroneDebt = async () => {
    if (!planValid || isBusy) {
      return;
    }

    const confirmed = window.confirm(
      "This is a real-money Throne debt request. Payments are not automatically verified. Each installment must be submitted and manually approved.",
    );

    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    setStatusText("");

    try {
      const response = await fetch("/api/user/throne-debts", {
        body: JSON.stringify({
          action: "create",
          contractLengthWeeks: cleanLengthWeeks,
          optionalNote: userNote,
          repaymentFrequency,
          totalAmountUsd: Number(totalAmountUsd),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        contract?: ThroneDebtContract;
        error?: string;
      };

      if (!response.ok || !payload.contract) {
        throw new Error(payload.error ?? "Throne Debt request failed.");
      }

      await loadThroneDebts();
      setStatusText("Throne Debt request submitted for manual review.");
      setUserNote("");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Throne Debt request failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const submitPaymentReview = async () => {
    if (!selectedInstallment || isBusy) {
      return;
    }

    setIsBusy(true);
    setStatusText("");

    try {
      const response = await fetch("/api/user/throne-debts", {
        body: JSON.stringify({
          action: "submit_payment",
          installmentId: selectedInstallment.id,
          throneOrderLink,
          userNote: paymentNote,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        contracts?: ThroneDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Payment review submission failed.");
      }

      setContracts(payload.contracts ?? contracts);
      setThroneOrderLink("");
      setPaymentNote("");
      setSelectedInstallmentId("");
      setStatusText("Payment submitted for admin review. It is not paid until approved.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Payment review submission failed.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
      <article className="court-feature-panel court-grid-card court-grid-card--gold rounded-[1.5rem] border border-amber-200/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.22),rgba(0,0,0,0.72))] p-4 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Throne Debt</p>
          <h3 className="mt-1 text-lg font-black text-white">Throne Debt Contract</h3>
        </div>
        <span className="rounded-full border border-amber-200/25 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase text-amber-50">
          Manual
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Real-money debt via Throne. All payments are manually reviewed. Minimum installment: $10 per week.
      </p>

      {activeContract ? (
        <div className="mt-4 grid gap-3">
          <div className="court-inset-tile rounded-2xl border border-amber-200/15 bg-black/35 p-3">
            <div className="grid gap-2 text-sm text-amber-50 sm:grid-cols-2">
              <span>Total Debt: ${activeContract.total_amount_usd.toFixed(2)}</span>
              <span>Paid: ${paidUsd.toFixed(2)}</span>
              <span>Remaining: ${remainingUsd.toFixed(2)}</span>
              <span>Frequency: {activeContract.repayment_frequency}</span>
              <span>Status: {activeContract.status}</span>
              <span>Installments: {installments.filter((item) => item.status === "approved_paid").length} / {activeContract.installment_count}</span>
            </div>
            <p className="mt-3 rounded-2xl border border-yellow-200/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-50/85">
              Throne payments are handled outside the app. Submitting a payment for review does not mark it as paid until approved.
            </p>
            {activeContract.status === "timeout" ? (
              <p className="mt-3 rounded-2xl border border-red-200/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-50">
                Your account is in Throne Debt Timeout because a Throne Debt payment is overdue. To request removal, submit a Throne payment for the redemption amount. This must be manually reviewed and approved.
                {activeContract.timeout_redemption_amount_usd ? ` Redemption amount: $${activeContract.timeout_redemption_amount_usd.toFixed(2)}.` : ""}
              </p>
            ) : null}
          </div>

          {activeContract.status === "pending_review" ? (
            <p className="rounded-2xl border border-amber-200/20 bg-amber-400/10 px-3 py-3 text-sm font-bold text-amber-50">
              Pending manual admin approval. Installments are generated only after approval.
            </p>
          ) : null}

          {["active", "overdue", "timeout"].includes(activeContract.status) ? (
            <>
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2 [scrollbar-width:thin]">
                <div className="grid gap-2">
                  {installments.map((installment) => (
                    <button
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedInstallment?.id === installment.id
                          ? "border-amber-200/45 bg-amber-400/12"
                          : "border-white/10 bg-white/[0.04]"
                      }`}
                        disabled={!["pending", "rejected", "overdue", "timeout_redemption_required"].includes(installment.status)}
                      key={installment.id}
                      onClick={() => setSelectedInstallmentId(installment.id)}
                      type="button"
                    >
                      <span className="font-black text-white">#{installment.installment_number} - ${installment.amount_usd.toFixed(2)}</span>
                      <span className="ml-2 text-amber-100/70">{installment.status}</span>
                      <span className="block text-zinc-400">Due {new Date(installment.due_date).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <input
                className="rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                disabled={disabled || isBusy || !selectedInstallment}
                onChange={(event) => setThroneOrderLink(event.target.value)}
                placeholder={activeContract.status === "timeout" ? "Throne redemption order link" : "Throne order link"}
                value={throneOrderLink}
              />
              <textarea
                className="min-h-20 rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                disabled={disabled || isBusy || !selectedInstallment}
                maxLength={500}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder={activeContract.status === "timeout" ? "Optional redemption note" : "Optional payment note"}
                value={paymentNote}
              />
              <button
                className="rounded-2xl border border-amber-200/25 bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-50 transition hover:border-amber-200/55 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || isBusy || !selectedInstallment || !throneOrderLink.trim()}
                onClick={() => void submitPaymentReview()}
                type="button"
              >
                {activeContract.status === "timeout" ? "Submit Redemption Proof for Review" : "Submit Throne Payment for Review"}
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              disabled={disabled || isBusy || isTimeoutActive}
              inputMode="decimal"
              min={plan.minimumTotalUsd}
              onChange={(event) => setTotalAmountUsd(event.target.value)}
              placeholder="Total USD"
              value={totalAmountUsd}
            />
            <select
              className="rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              disabled={disabled || isBusy || isTimeoutActive}
              onChange={(event) => setRepaymentFrequency(event.target.value as ThroneDebtFrequency)}
              value={repaymentFrequency}
            >
              <option value="weekly">Weekly</option>
              <option value="bi_weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              className="rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
              disabled={disabled || isBusy || isTimeoutActive}
              onChange={(event) => setContractLengthWeeks(event.target.value)}
              value={contractLengthWeeks}
            >
              <option value="">Length</option>
              {THRONE_DEBT_LENGTH_OPTIONS.map((weeks) => (
                <option key={weeks} value={weeks}>{weeks} weeks</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {contractLengthWeeks === "custom" ? (
              <input
                className="rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                disabled={disabled || isBusy || isTimeoutActive}
                inputMode="numeric"
                max={104}
                min={4}
                onChange={(event) => setCustomLengthWeeks(event.target.value)}
                placeholder="Custom weeks"
                value={customLengthWeeks}
              />
            ) : null}
          </div>
          <div className="rounded-2xl border border-amber-200/15 bg-black/35 p-3 text-sm text-amber-50">
            {hasPlanInputs ? (
              <>
                <p>Total Debt: ${plan.totalAmountUsd.toFixed(2)}</p>
                <p>Installments: {plan.installmentCount}</p>
                <p>Each Installment: ${plan.installmentAmountUsd.toFixed(2)}</p>
                <p>Minimum for this frequency: ${minimumInstallmentUsd.toFixed(2)}</p>
              </>
            ) : (
              <p>Enter total amount and contract length to calculate the installment plan.</p>
            )}
            {hasPlanInputs && !planValid ? (
              <p className="mt-2 text-xs font-bold text-red-200">
                Increase total amount or adjust length. This plan is below minimum installment.
              </p>
            ) : null}
          </div>
          <textarea
            className="min-h-20 rounded-2xl border border-amber-200/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
            disabled={disabled || isBusy || isTimeoutActive}
            maxLength={500}
            onChange={(event) => setUserNote(event.target.value)}
            placeholder="Optional note"
            value={userNote}
          />
          <button
            className="rounded-2xl border border-amber-200/25 bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-50 transition hover:border-amber-200/55 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || isBusy || isTimeoutActive || !planValid}
            onClick={() => void createThroneDebt()}
            type="button"
          >
            Submit Throne Debt Request
          </button>
          {isTimeoutActive ? (
            <p className="rounded-2xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
              You cannot create new debt while your account is in timeout.
            </p>
          ) : null}
        </div>
      )}

      {statusText ? (
        <p className="mt-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-bold text-amber-50/85">
          {statusText}
        </p>
      ) : null}
    </article>
  );
}

function DebtCard(props: {
  active: boolean;
  canManageActiveDebtWhileTimedOut: boolean;
  currentKind: "normal" | "evil" | null;
  debtInstallmentNumber: number;
  debtPaymentDue: boolean;
  hasMissedInstallment: boolean;
  debtTask: PetTaskItem;
  disabled: boolean;
  blockingContractMessage: string | null;
  hasOpenDebtContract: boolean;
  isDebtAutoPayEnabled: boolean;
  isPetActionPending: (actionId: string) => boolean;
  isTimeoutActive: boolean;
  kind: "normal";
  capacityPreview: DebtCapacityPreview | null;
  capacityPreviewError: string;
  normalDebtAmount: string;
  normalDebtDuration: string;
  normalDebtDurationLimit: { label: string; max: number; min: number };
  normalDebtMinimumPayment: number;
  normalDebtPeriodType: "weekly" | "monthly";
  normalPetName: string;
  normalPurchasePledge: boolean;
  now: number;
  onDebtAutoPayChange: (enabled: boolean) => void;
  onNormalDebtAmountChange: (value: string) => void;
  onNormalDebtDurationChange: (value: string) => void;
  onNormalDebtPeriodTypeChange: (value: "weekly" | "monthly") => void;
  onNormalPetNameChange: (value: string) => void;
  onNormalPurchasePledgeChange: (value: boolean) => void;
  onPayDebtPeriod: () => void;
  onRandomDebtSign: () => void;
  onSign: () => void;
  petDebtContract: PetDebtContract | null;
  remainingDebtBalance: number;
}) {
  const {
    active,
    capacityPreview,
    capacityPreviewError,
    canManageActiveDebtWhileTimedOut,
    currentKind,
    debtInstallmentNumber,
    debtPaymentDue,
    hasMissedInstallment,
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
    normalPurchasePledge,
    now,
    onDebtAutoPayChange,
    onNormalDebtAmountChange,
    onNormalDebtDurationChange,
    onNormalDebtPeriodTypeChange,
    onNormalPetNameChange,
    onNormalPurchasePledgeChange,
    onPayDebtPeriod,
    onRandomDebtSign,
    onSign,
    petDebtContract,
    remainingDebtBalance,
  } = props;

  const showLockedState = hasOpenDebtContract && !active && petDebtContract;
  const contractControlsDisabled = disabled || isTimeoutActive;
  const activeDebtControlsDisabled =
    disabled || (isTimeoutActive && !canManageActiveDebtWhileTimedOut);
  const contractCreationDisabled = contractControlsDisabled || hasOpenDebtContract;

  return (
      <article className="court-feature-panel court-grid-card court-grid-card--danger rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-4 shadow-[0_0_22px_rgba(127,29,29,0.12)]">
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
        <div className="court-inset-tile mt-4 rounded-2xl border border-red-200/15 bg-black/35 p-3">
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
              disabled={activeDebtControlsDisabled}
              enabled={isDebtAutoPayEnabled}
              onChange={onDebtAutoPayChange}
            />
            <p className="mt-2 text-yellow-50/75">
              When enabled, the full installment is collected automatically the moment your balance can cover it.
            </p>
            <p className="mt-2 text-yellow-50/75">
              Missed payments enter a 48-hour grace period and then go to admin review. Debt timeout is never applied automatically.
            </p>
          </div>
          <button
            className="mt-4 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeDebtControlsDisabled || !debtPaymentDue || isPetActionPending("pet-debt-contract")}
            onClick={onPayDebtPeriod}
            type="button"
          >
            {isPetActionPending("pet-debt-contract")
              ? "Saving..."
              : !debtPaymentDue
                ? "Next installment locked"
                : hasMissedInstallment
                  ? "Catch up missed installment"
                  : "Pay current installment"}
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
          <PurchasePledgeCheckbox
            checked={normalPurchasePledge}
            disabled={contractCreationDisabled}
            onChange={onNormalPurchasePledgeChange}
          />
          <DebtCapacitySummary
            amount={normalDebtAmount}
            capacity={capacityPreview}
            error={capacityPreviewError}
            duration={normalDebtDuration}
          />
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
            Auto payment is off by default. Turn it on only if you want the full installment collected the moment your balance can cover it.
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
  canManageActiveDebtWhileTimedOut: boolean;
  currentKind: "normal" | "evil" | null;
  debtInstallmentNumber: number;
  debtPaymentDue: boolean;
  hasMissedInstallment: boolean;
  disabled: boolean;
  blockingContractMessage: string | null;
  capacityPreview: DebtCapacityPreview | null;
  capacityPreviewError: string;
  evilAge: string;
  evilConsentPrimary: string;
  evilConsentSecondary: string;
  evilCustomNote: string;
  evilDebtAmount: string;
  evilDebtDuration: string;
  evilDebtDurationLimit: { label: string; max: number; min: number };
  evilDebtMinimumPayment: number;
  evilDebtPeriodType: "weekly" | "monthly";
  evilPurchasePledge: boolean;
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
  onEvilPurchasePledgeChange: (value: boolean) => void;
  onEvilTimezoneChange: (value: string) => void;
  onPayDebtPeriod: () => void;
  onSign: () => void;
  petDebtContract: PetDebtContract | null;
  remainingDebtBalance: number;
}) {
  const {
    active,
    canManageActiveDebtWhileTimedOut,
    currentKind,
    debtInstallmentNumber,
    debtPaymentDue,
    hasMissedInstallment,
    disabled,
    blockingContractMessage,
    capacityPreview,
    capacityPreviewError,
    evilAge,
    evilConsentPrimary,
    evilConsentSecondary,
    evilCustomNote,
    evilDebtAmount,
    evilDebtDuration,
    evilDebtDurationLimit,
    evilDebtMinimumPayment,
    evilDebtPeriodType,
    evilPurchasePledge,
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
    onEvilPurchasePledgeChange,
    onEvilTimezoneChange,
    onPayDebtPeriod,
    onSign,
    petDebtContract,
    remainingDebtBalance,
  } = props;

  const showLockedState = hasOpenDebtContract && !active && petDebtContract;
  const contractControlsDisabled = disabled || isTimeoutActive;
  const activeDebtControlsDisabled =
    disabled || (isTimeoutActive && !canManageActiveDebtWhileTimedOut);
  const contractCreationDisabled = contractControlsDisabled || hasOpenDebtContract;

  return (
      <article className="court-feature-panel court-grid-card court-grid-card--danger rounded-[1.5rem] border border-red-500/25 bg-[linear-gradient(180deg,rgba(69,10,10,0.5),rgba(0,0,0,0.8))] p-4 shadow-[0_0_28px_rgba(127,29,29,0.2)]">
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
                  disabled={activeDebtControlsDisabled}
                  enabled={isDebtAutoPayEnabled}
                  onChange={onDebtAutoPayChange}
                />
                <p className="mt-2 text-yellow-50/75">
                  When enabled, the full installment is collected automatically the moment your balance can cover it.
                </p>
                <p className="mt-2 text-yellow-50/75">
                  Missed payments enter a 48-hour grace period and then go to admin review. Debt timeout is never applied automatically.
                </p>
              </div>
              <button
                className="mt-4 w-full rounded-2xl border border-red-200/25 bg-red-600/15 px-4 py-3 text-sm font-black text-red-50 transition enabled:hover:border-red-200/55 enabled:hover:bg-red-600/25 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={activeDebtControlsDisabled || !debtPaymentDue || isPetActionPending("pet-debt-contract")}
                onClick={onPayDebtPeriod}
                type="button"
              >
                {isPetActionPending("pet-debt-contract")
                  ? "Saving..."
                  : !debtPaymentDue
                    ? "Next installment locked"
                    : hasMissedInstallment
                      ? "Catch up missed installment"
                      : "Pay current installment"}
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
          <PurchasePledgeCheckbox
            checked={evilPurchasePledge}
            disabled={contractCreationDisabled}
            onChange={onEvilPurchasePledgeChange}
          />
          <DebtCapacitySummary
            amount={evilDebtAmount}
            capacity={capacityPreview}
            error={capacityPreviewError}
            duration={evilDebtDuration}
          />
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

function PurchasePledgeCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-amber-200/20 bg-amber-500/10 px-3 py-3 text-xs font-bold text-amber-50/90">
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 accent-amber-500"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        If I cannot cover a scheduled payment, I may purchase coins to complete it. I understand that a missed payment can result in a 7-day timeout only after admin review.
        <span className="mt-1 block font-medium text-amber-100/65">
          Optional and unchecked by default. Accepting it doubles the affordability limit (+100%).
        </span>
      </span>
    </label>
  );
}

function DebtCapacitySummary({
  amount,
  capacity,
  duration,
  error,
}: {
  amount: string;
  capacity: DebtCapacityPreview | null;
  duration: string;
  error: string;
}) {
  if (error) {
    return (
      <p className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-100">
        {error}
      </p>
    );
  }

  if (!capacity) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-zinc-400">
        Enter a duration to calculate your server-verified affordability limit.
      </p>
    );
  }

  const installmentAmount = Math.max(0, Math.floor(Number(amount)));
  const durationPeriods = Math.max(0, Math.floor(Number(duration)));
  const requestedTotal = installmentAmount * durationPeriods;
  const reviewedExposure = installmentAmount * capacity.evaluatedPeriods;
  const overLimit = reviewedExposure > capacity.totalLimit;

  return (
    <div className={`rounded-2xl border px-3 py-3 text-xs ${
      overLimit
        ? "border-rose-200/25 bg-rose-500/10 text-rose-50"
        : "border-emerald-200/20 bg-emerald-500/10 text-emerald-50"
    }`}>
      <p className="font-black uppercase tracking-[0.14em]">Affordability check</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <span>Balance: {capacity.balanceCoins.toLocaleString()}</span>
        <span>75% balance capacity: {capacity.balanceComponent.toLocaleString()}</span>
        <span>Reliable period income: {capacity.reliablePeriodIncome.toLocaleString()}</span>
        <span>Reviewed periods: {capacity.evaluatedPeriods}</span>
        <span>Affordability limit: {capacity.totalLimit.toLocaleString()}</span>
        <span>Reviewed exposure: {reviewedExposure.toLocaleString()}</span>
        <span>Full contract total: {requestedTotal.toLocaleString()}</span>
        <span>Pledge boost: {capacity.purchasePledgeBoost.toLocaleString()}</span>
      </div>
      <p className="mt-2 font-bold">
        {overLimit
          ? "The near-term payment exposure exceeds your current limit."
          : "The near-term payment exposure is within your current limit."}
      </p>
    </div>
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
