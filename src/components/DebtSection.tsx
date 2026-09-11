"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateThroneDebtPlan,
  getThroneDebtMinimumInstallmentUsd,
  getThroneDebtPaidTotal,
  getThroneDebtInstallmentRemaining,
  THRONE_DEBT_LENGTH_OPTIONS,
  THRONE_DEBT_INSTALLMENT_LABELS,
  type ThroneDebtContract,
  type ThroneDebtFrequency,
} from "@/lib/throne-debt";
import type { PetDebtContract, PetTaskItem } from "@/lib/types";
import { useDeadlineClock } from "@/hooks/useDeadlineClock";

const DEBT_PET_NAMES = ["Debt Piglet", "Wallet Worm", "Paypig Princess", "Debt Doll", "Tribute Toy", "Debt Addict", "Owned ATM", "Forever Indebted", "Drainlet", "Paywhore", "Cuckie"];
const DEBT_SIGNING_IMAGE_PATH = "/pet/debt-contract-signed.webp";
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
  onMoneyChange?: (money: number) => void;
  previewMode?: boolean;
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

async function getAffordableRandomDebtDraft(purchasePledge: boolean): Promise<{
  amount: number;
  duration: number;
  periodType: "weekly" | "monthly";
} | null> {
  const periodTypes: Array<"weekly" | "monthly"> = Math.random() < 0.5
    ? ["weekly", "monthly"]
    : ["monthly", "weekly"];

  for (const periodType of periodTypes) {
    const durationLimit = DEBT_RANDOM_DURATION_LIMITS[periodType];
    const duration = randomInteger(durationLimit.min, durationLimit.max);
    const response = await fetch("/api/user/debt-contracts", {
      body: JSON.stringify({ action: "capacity", durationPeriods: duration, periodType, purchasePledge }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { capacity?: DebtCapacityPreview };
    const capacity = payload.capacity;

    if (!response.ok || !capacity) continue;

    const amountLimit = DEBT_RANDOM_AMOUNT_LIMITS[periodType];
    const amountStep = DEBT_RANDOM_AMOUNT_STEPS[periodType];
    const affordableMaximum = Math.min(
      amountLimit.max,
      Math.floor(capacity.totalLimit / capacity.evaluatedPeriods / amountStep) * amountStep,
    );

    if (affordableMaximum < amountLimit.min) continue;

    return {
      amount: randomInteger(amountLimit.min / amountStep, affordableMaximum / amountStep) * amountStep,
      duration,
      periodType,
    };
  }

  return null;
}

export function DebtSection({
  onMoneyChange,
  previewMode = false,
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
    const draft = await getAffordableRandomDebtDraft(normalPurchasePledge);

    if (!draft) {
      window.alert("Your current affordability limit is below the minimum for a random debt contract.");
      return;
    }
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
    <section className="court-grid court-grid--debt grid min-w-0 gap-6 xl:grid-cols-2">
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
      <ThroneDebtCard onMoneyChange={onMoneyChange} previewMode={previewMode} disabled={disabled} isTimeoutActive={isTimeoutActive} />
    </section>
  );
}

function ThroneDebtCard({
  onMoneyChange,
  previewMode = false,
  disabled = false,
  isTimeoutActive = false,
}: {
  onMoneyChange?: (money: number) => void;
  disabled?: boolean;
  previewMode?: boolean;
  isTimeoutActive?: boolean;
}) {
  const [money, setMoney] = useState<number | null>(null);
  const [historyId, setHistoryId] = useState("");
  const [paymentThrough, setPaymentThrough] = useState(0);
  const pmRequest = useRef<{id: string; key: string} | null>(null);
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

  const openContract = contracts.find((contract) =>
    ["pending_review", "active", "overdue", "timeout", "paused"].includes(contract.status),
  ) ?? null;
  const activeContract = contracts.find(contract => contract.id === historyId) ?? openContract ?? contracts[0] ?? null;
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
    Number.isSafeInteger(Number(totalAmountUsd)) &&
    Number.isInteger(cleanLengthWeeks) &&
    cleanLengthWeeks >= 4 &&
    cleanLengthWeeks <= 104 &&
    Math.min(...plan.installmentAmountsUsd) >= minimumInstallmentUsd;
  const paidUsd = activeContract ? getThroneDebtPaidTotal(activeContract) : 0;
  const remainingUsd = activeContract ? Math.max(0, Number(activeContract.total_amount_usd) - Number(activeContract.rounding_waived_usd ?? 0) - paidUsd) : 0;
  const installments = activeContract?.installments ?? [];
  const nextInstallment = installments.find((installment) =>
    ["pending", "rejected", "overdue", "timeout_redemption_required"].includes(installment.status),
  ) ?? null;
  const selectedInstallment = installments.find((installment) => installment.id === selectedInstallmentId)
    ?? nextInstallment
    ?? null;

  const loadThroneDebts = useCallback(async () => {
    if (previewMode) return;
    try {
      const response = await fetch("/api/user/throne-debts", { cache: "no-store" });
      const payload = (await response.json()) as {
        money?: number;
        contracts?: ThroneDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Throne Debt could not be loaded.");
      }

      setContracts(payload.contracts ?? []);
      if (typeof payload.money === "number") setMoney(payload.money);
      setStatusText("");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Throne Debt could not be loaded.");
    }
  }, [previewMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadThroneDebts();
    }, 0);

    const refresh = () => { if (document.visibilityState === "visible") void loadThroneDebts(); };
    const interval = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer); window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadThroneDebts]);

  const createThroneDebt = async () => {
    if (!planValid || isBusy || disabled || isTimeoutActive) return;
    if (!window.confirm("Submit this real-money debt agreement for approval? Approved installments can be paid with PM or Throne.")) return;
    setIsBusy(true);
    try {
      const response = await fetch("/api/user/throne-debts", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",contractLengthWeeks:cleanLengthWeeks,repaymentFrequency,totalAmountUsd:Number(totalAmountUsd),optionalNote:userNote})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Request failed.");
      setHistoryId(payload.contract.id);
      await loadThroneDebts(); setUserNote(""); setStatusText("Your request is awaiting approval.");
    } catch(error) {setStatusText(error instanceof Error ? error.message : "Request failed.");}
    finally {setIsBusy(false);}
  };
  const submitPaymentReview = async () => {
    if (!selectedInstallment || isBusy || disabled) return;
    setIsBusy(true);
    try {
      const response = await fetch("/api/user/throne-debts", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit_payment",installmentId:selectedInstallment.id,throneOrderLink,userNote:paymentNote})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Review submission failed.");
      await loadThroneDebts();setThroneOrderLink("");setPaymentNote("");setSelectedInstallmentId("");setStatusText("Payment submitted for review. It is settled only after approval.");
    } catch(error) {setStatusText(error instanceof Error ? error.message : "Review submission failed.");}
    finally {setIsBusy(false);}
  };
  const payable = installments.filter(item => getThroneDebtInstallmentRemaining(item) > 0);
  const through = payable.some(item => item.installment_number === paymentThrough) ? paymentThrough : payable[0]?.installment_number ?? 0;
  const pmCost = Math.round(payable.filter(item => item.installment_number <= through).reduce((sum,item) => sum + getThroneDebtInstallmentRemaining(item),0)*100)/100;
  const hasReview = activeContract?.payment_reviews?.some(review => review.status === "pending");
  const canPay = !!activeContract && ["active","overdue"].includes(activeContract.status) && !hasReview;
  const usd = (amount: number) => "$" + Number(amount).toFixed(2);
  const label = (value: string) => value.split("_").map(word => word.charAt(0).toUpperCase()+word.slice(1)).join(" ");
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}) : "Awaiting approval";
  const payPm = async () => {
    if (!activeContract || isBusy || !canPay || !pmCost || !Number.isInteger(pmCost)) return;
    const key = activeContract.id + ":" + through + ":" + pmCost;
    if (pmRequest.current?.key !== key) pmRequest.current = {key,id:crypto.randomUUID()};
    setIsBusy(true); setStatusText("");
    try {
      const response = await fetch("/api/user/throne-debts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pay_pm",contractId:activeContract.id,requestId:pmRequest.current.id,throughInstallment:through,expectedAmount:pmCost})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Payment could not be confirmed. Please retry.");
      pmRequest.current=null;
      setMoney(payload.money); onMoneyChange?.(payload.money);
      await loadThroneDebts();
      setStatusText(payload.spent + " PM paid toward your contract.");
    } catch(error) { setStatusText(error instanceof Error ? error.message : "Payment could not be confirmed. Please retry."); }
    finally {setIsBusy(false);}
  };
  return (
    <article className="throne-agreement xl:col-span-2">
      <header className="throne-agreement__cover">
        <div><p className="throne-agreement__eyebrow">The private court of Principessa</p><h3>Throne Debt<br/><em>Agreement</em></h3><p>A promise recorded. Every payment accounted for.</p></div>
        <div className="throne-agreement__seal" aria-label="Principessa contract seal"><span>P</span><small>BY HER AUTHORITY</small></div>
      </header>
      <div className="throne-agreement__body">
      {contracts.length > 1 ? <label className="throne-agreement__history">Contract archive<select value={activeContract?.id ?? ""} onChange={event => {setHistoryId(event.target.value);setPaymentThrough(0);setSelectedInstallmentId("");}}>{contracts.map(contract => <option key={contract.id} value={contract.id}>{contract.debt_code} · {label(contract.status)}</option>)}</select></label> : null}
      {activeContract ? <>
        <div className="throne-agreement__reference"><div><small>CONTRACT REFERENCE</small><strong>{activeContract.debt_code}</strong></div><span className="throne-agreement__status">{label(activeContract.status)}</span></div>
        <dl className="throne-agreement__figures">
          <div><dt>Original commitment</dt><dd>{usd(activeContract.total_amount_usd)}</dd></div>
          <div><dt>Settled installments & credits</dt><dd>{usd(paidUsd)}</dd></div>
          <div><dt>Rounding waived</dt><dd>{usd(activeContract.rounding_waived_usd ?? 0)}</dd></div>
          <div><dt>Remaining balance</dt><dd>{usd(remainingUsd)}</dd></div>
        </dl>
        <div className="throne-agreement__progress" role="progressbar" aria-label="Contract settled" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1-remainingUsd/activeContract.total_amount_usd)*100)}><span style={{width:Math.max(0,Math.min(100,(1-remainingUsd/activeContract.total_amount_usd)*100))+"%"}}/></div>
        <div className="throne-agreement__terms"><p><strong>01 / The commitment</strong> Approved {date(activeContract.approved_at)}. {activeContract.contract_length_weeks} weeks · {activeContract.repayment_frequency === "weekly" ? "Every week" : activeContract.repayment_frequency === "bi_weekly" ? "Every 2 weeks" : "Every 4 weeks"} · {activeContract.installment_count} installments.</p><p><strong>02 / Accepted payment</strong> Pay with PM at 1 PM = $1, or include <b>{activeContract.debt_code}</b> in your Throne payment message. TD payments reduce this debt and do not add PM. Payments cover the earliest unpaid installment first; you may pay ahead or settle the full balance.</p><p><strong>03 / Due dates & review</strong> Partial payments reduce the amount due but do not postpone its date. Unmatched payments need review. Overdue payments may lead to account timeout; timeout redemption is a separate, manually reviewed process.</p></div>
        {activeContract.schedule_adjusted_at ? <div className="throne-agreement__amendment"><strong>Schedule amendment · {date(activeContract.schedule_adjusted_at)}</strong><p>Unpaid amounts were redistributed into whole-dollar payments. {usd(activeContract.rounding_waived_usd ?? 0)} was waived, not added to a future installment. Previous approvals and due dates remain valid. “Settled” includes manual approvals; the actual cash received for older approvals was not recorded.</p></div> : null}
        {activeContract.status === "pending_review" ? <p className="throne-agreement__notice">Pending manual admin approval. Your dated schedule will appear after approval.</p> : null}
        <div className="throne-agreement__columns">
          <section><h4>Schedule of payments</h4><p className="throne-agreement__caption">{installments.filter(item => item.status === "approved_paid").length} of {activeContract.installment_count} installments settled</p>
            <div className="throne-agreement__schedule">{installments.map(item => <div className="throne-agreement__installment" key={item.id}>
              <div><strong>No. {String(item.installment_number).padStart(2,"0")}</strong><small>Due {date(item.due_date)}</small><span className={item.status === "approved_paid" ? "throne-agreement__paid" : ""}>{THRONE_DEBT_INSTALLMENT_LABELS[item.status]}</span></div>
              <div className="throne-agreement__amount"><strong>{usd(getThroneDebtInstallmentRemaining(item))} due</strong><small>Scheduled {usd(item.amount_usd)}</small>{item.original_amount_usd != null && item.original_amount_usd !== item.amount_usd ? <small>Originally {usd(item.original_amount_usd)}</small> : null}<small>Throne credits {usd(item.webhook_paid_usd ?? 0)} · PM {usd(item.pm_paid_usd ?? 0)}</small>{item.status === "approved_paid" && Number(item.webhook_paid_usd ?? 0)+Number(item.pm_paid_usd ?? 0)<Number(item.amount_usd) ? <small>Includes manual settlement</small> : null}{item.paid_at ? <small>Settled {date(item.paid_at)}</small> : null}</div>
            </div>)}</div>
          </section>
          <aside className="throne-agreement__payment"><h4>Honor your agreement</h4><p>Your balance: <strong>{money === null ? "Loading…" : money + " PM"}</strong></p>
            {canPay && payable.length ? <><label>Pay installments through<select aria-label="Pay installments through" value={through} disabled={isBusy} onChange={event => setPaymentThrough(Number(event.target.value))}>{payable.map(item => <option key={item.id} value={item.installment_number}>{item.installment_number === payable[0].installment_number ? "Next installment" : item.installment_number === payable[payable.length-1].installment_number ? "Full remaining balance" : "Through installment #"+item.installment_number} · {usd(payable.filter(row=>row.installment_number<=item.installment_number).reduce((sum,row)=>sum+getThroneDebtInstallmentRemaining(row),0))}</option>)}</select></label><p className="throne-agreement__quote">{pmCost} PM <span>reduces your debt by {usd(pmCost)}</span></p><p>Balance after payment: {money === null ? "—" : Math.max(0,money-pmCost)+" PM"}</p><button type="button" disabled={disabled || isBusy || money === null || money<pmCost || !Number.isInteger(pmCost)} onClick={()=>void payPm()}>{isBusy ? "Processing…" : "Pay "+pmCost+" PM"}</button>{money !== null && money<pmCost ? <p>Not enough PM for this payment.</p> : null}{!Number.isInteger(pmCost) ? <p>This payment contains cents. Use Throne or request a manual review.</p> : null}</> : <p>{hasReview ? "A payment is awaiting review. Please wait before paying again." : activeContract.status === "completed" ? "Your agreement is fulfilled. No balance remains." : "PM payments are available for active and overdue contracts."}</p>}
            <div className="throne-agreement__throne"><strong>Prefer Throne?</strong><p>Include this exact code in your message:</p><code>{activeContract.debt_code}</code><p>Extra funds cover future installments. Any excess after the final installment is recorded separately and does not become PM.</p></div>
          </aside>
        </div>
        <details className="throne-agreement__details"><summary>Payment record & manual review</summary>
          {(activeContract.payments ?? []).map(payment => <p key={payment.event_id}>{date(payment.created_at)} · Throne {usd(payment.amount_usd)} · Applied {usd(payment.applied_usd)}{payment.status === "needs_review" ? " · Awaiting review" : ""}{payment.amount_usd > payment.applied_usd ? " · Unapplied " + usd(payment.amount_usd-payment.applied_usd) : ""}</p>)}
          {(activeContract.pm_payments ?? []).map(payment => <p key={payment.id}>{date(payment.created_at)} · {payment.amount_pm} PM · {payment.allocations.map(part=>"#"+part.installment+": "+usd(part.amount)).join(" / ")}</p>)}
          {(activeContract.payment_reviews ?? []).map(review => <p key={review.id}>{date(review.created_at)} · Manual review · {label(review.status)}{review.admin_note ? " · "+review.admin_note : ""}</p>)}
          {![...(activeContract.payments ?? []),...(activeContract.pm_payments ?? []),...(activeContract.payment_reviews ?? [])].length ? <p>No payment receipts recorded. Older manual approvals are shown in the schedule above.</p> : null}
          {["active","overdue","timeout"].includes(activeContract.status) ? <div className="throne-agreement__proof"><h4>Payment not detected?</h4><p>{activeContract.status === "timeout" ? "Timeout redemption: "+usd(activeContract.timeout_redemption_amount_usd ?? 0)+". Submit proof for manual approval." : "Submit your Throne order for a manual check. Select the installment it covers."}</p><select aria-label="Installment for manual review" value={selectedInstallment?.id ?? ""} onChange={event=>setSelectedInstallmentId(event.target.value)} disabled={isBusy}>{installments.filter(item=>["pending","rejected","overdue","timeout_redemption_required"].includes(item.status)).map(item=><option key={item.id} value={item.id}>Installment #{item.installment_number} · {usd(getThroneDebtInstallmentRemaining(item))}</option>)}</select><input aria-label="Throne order link" placeholder="Throne order link" value={throneOrderLink} onChange={event=>setThroneOrderLink(event.target.value)} disabled={isBusy}/><textarea aria-label="Payment note" placeholder="Optional payment note" maxLength={500} value={paymentNote} onChange={event=>setPaymentNote(event.target.value)} disabled={isBusy}/><button type="button" disabled={disabled || isBusy || !selectedInstallment || !throneOrderLink.trim()} onClick={()=>void submitPaymentReview()}>Submit Throne Payment for Review</button></div> : null}
        </details>
        {activeContract.user_note ? <p><strong>Your note:</strong> {activeContract.user_note}</p> : null}{activeContract.admin_note ? <p><strong>Principessa’s note:</strong> {activeContract.admin_note}</p> : null}
        <footer className="throne-agreement__signature"><span>Principessa<small>THE COURT</small></span><span>{activeContract.debt_code}<small>{activeContract.approved_at ? "APPROVED · "+date(activeContract.approved_at) : "AWAITING APPROVAL"}</small></span></footer>
      </> : null}
      {!openContract ? <details open={!activeContract} className="throne-agreement__request"><summary>{activeContract ? "Request another agreement" : "Draft your agreement"}</summary><p>Minimum $10 per week. Your request is reviewed before a contract begins. Pay approved installments with PM or Throne.</p>
        <div className="throne-agreement__draft">
          <label>Total commitment (USD)<input placeholder="Total USD" inputMode="numeric" disabled={disabled || isBusy || isTimeoutActive} value={totalAmountUsd} onChange={event=>setTotalAmountUsd(event.target.value)}/></label>
          <label>Repayment frequency<select disabled={disabled || isBusy || isTimeoutActive} value={repaymentFrequency} onChange={event=>setRepaymentFrequency(event.target.value as ThroneDebtFrequency)}><option value="weekly">Every week</option><option value="bi_weekly">Every 2 weeks</option><option value="monthly">Every 4 weeks</option></select></label>
          <label>Contract length<select aria-label="Contract length" disabled={disabled || isBusy || isTimeoutActive} value={contractLengthWeeks} onChange={event=>setContractLengthWeeks(event.target.value)}><option value="">Length</option>{THRONE_DEBT_LENGTH_OPTIONS.map(weeks=><option key={weeks} value={weeks}>{weeks} weeks</option>)}<option value="custom">Custom</option></select></label>
          {contractLengthWeeks === "custom" ? <label>Custom weeks<input inputMode="numeric" disabled={disabled || isBusy || isTimeoutActive} value={customLengthWeeks} onChange={event=>setCustomLengthWeeks(event.target.value)}/></label> : null}
        </div>
        {hasPlanInputs ? <><p>Payment schedule: {plan.installmentAmountsUsd.map(amount=>"$"+amount).join(" + ")}</p>{!planValid ? <p>Use a whole-dollar total, 4–104 weeks, and at least {usd(minimumInstallmentUsd)} per installment.</p> : null}</> : <p>Enter a total and length to preview every installment before submitting.</p>}
        <label>Your note (optional)<textarea maxLength={500} disabled={disabled || isBusy || isTimeoutActive} value={userNote} onChange={event=>setUserNote(event.target.value)}/></label>
        <button type="button" disabled={disabled || isBusy || isTimeoutActive || !planValid} onClick={()=>void createThroneDebt()}>Submit Throne Debt Request</button>
        {isTimeoutActive ? <p>You cannot create new debt while your account is in timeout.</p> : null}
      </details> : null}
      {statusText ? <p role="status" className="throne-agreement__notice">{statusText}</p> : null}
      </div>
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
