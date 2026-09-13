"use client";
import { emitSoundEvent } from "@/lib/sound";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ContractDocument, ContractClause, ContractField, ContractSignature, CoinContractSummary } from "./DebtContractPresentation";
import styles from "./DebtContracts.module.css";
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
const DEBT_SIGNING_IMAGE_PATH = "/principessa-ui/generated/principessa-debt-contract.webp";
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
  const [throneSummary, setThroneSummary] = useState<ThroneDebtContract | null>(null);
  const [contractFilters, setContractFilters] = useState<Array<"coin" | "evil" | "throne">>([]);
  const toggleContractFilter = (kind: "coin" | "evil" | "throne") => setContractFilters(current => {
    const next = current.includes(kind) ? current.filter(value => value !== kind) : [...current, kind];
    return next.length === 3 ? [] : next;
  });
  const contractVisible = (kind: "coin" | "evil" | "throne") => {
    if (hasOpenDebtContract && (kind === "coin" && activeDebtContractType === "evil" || kind === "evil" && activeDebtContractType === "normal")) return false;
    return contractFilters.length === 0 || contractFilters.includes(kind);
  };
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
    <section className={styles.documents} aria-label="Debt agreements" data-recorded-layout={hasOpenDebtContract} data-visible-count={(["coin", "evil", "throne"] as const).filter(contractVisible).length}>
      <nav className={styles.index} aria-label="Filter agreements">
        {([{kind:"coin",label:"Coin Debt"},{kind:"evil",label:"Evil Debt"},{kind:"throne",label:"Throne Debt"}] as const).map((item,index)=><button type="button" key={item.kind} disabled={hasOpenDebtContract && (item.kind === "coin" && activeDebtContractType === "evil" || item.kind === "evil" && activeDebtContractType === "normal")} aria-pressed={contractFilters.includes(item.kind)} aria-controls={item.kind+"-contract-panel"} onClick={()=>toggleContractFilter(item.kind)}><span>{String(index+1).padStart(2,"0")}</span>{item.label}</button>)}
      </nav>
      <div className={styles.contractSlot} id="coin-contract-panel" hidden={!contractVisible("coin")}><DebtCard
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
      /></div>
      <div className={styles.contractSlot} id="evil-contract-panel" hidden={!contractVisible("evil")}><EvilDebtCard
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
      /></div>
      {hasOpenDebtContract && petDebtContract && <aside className={styles.commitmentColumn} aria-label="Recorded commitments">
        {(contractVisible("coin") || contractVisible("evil")) && <CoinContractSummary amount="" duration="" period={petDebtContract.period_type} contract={petDebtContract} remaining={remainingDebtBalance}/>}
        {contractVisible("throne") && throneSummary && ["active","overdue","timeout","paused"].includes(throneSummary.status) && <div className={styles.schedule}>
          <p className={styles.edition}>RECORDED COMMITMENT · THRONE</p><h4>The Throne account</h4>
          <div className={styles.total}>${Number(throneSummary.total_amount_usd).toLocaleString()}<small>ORIGINAL COMMITMENT</small></div>
          <dl className={styles.facts}><div><dt>Settled</dt><dd>${getThroneDebtPaidTotal(throneSummary).toLocaleString()}</dd></div><div><dt>Remaining</dt><dd>${Math.max(0, throneSummary.total_amount_usd - (throneSummary.rounding_waived_usd ?? 0) - getThroneDebtPaidTotal(throneSummary)).toLocaleString()}</dd></div><div><dt>Reference</dt><dd>{throneSummary.debt_code}</dd></div></dl>
          <p className={styles.scheduleNote}>Pay with PM or Throne. Your installment schedule and payment controls are in the Throne agreement.</p>
        </div>}
      </aside>}
      <div className={styles.contractSlot} id="throne-contract-panel" hidden={!contractVisible("throne")}><ThroneDebtCard onContractChange={setThroneSummary} onMoneyChange={onMoneyChange} previewMode={previewMode} disabled={disabled} isTimeoutActive={isTimeoutActive} /></div>
    </section>
  );
}

function ThroneDebtCard({
  onContractChange,
  onMoneyChange,
  previewMode = false,
  disabled = false,
  isTimeoutActive = false,
}: {
  onMoneyChange?: (money: number) => void;
  onContractChange?: (contract: ThroneDebtContract | null) => void;
  disabled?: boolean;
  previewMode?: boolean;
  isTimeoutActive?: boolean;
}) {
  const [money, setMoney] = useState<number | null>(null);
  const [historyId, setHistoryId] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
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
  const showingDraft = isDrafting && !openContract;
  const activeContract = contracts.find(contract => contract.id === historyId) ?? openContract ?? contracts[0] ?? null;
  useEffect(() => { onContractChange?.(openContract); }, [openContract, onContractChange]);
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
      return payload.contracts ?? [];
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
      setIsDrafting(false);
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
  const paymentNow = useDeadlineClock(payable.map(item => item.due_date), 60000);
  const includesEarlyPayment = payable.some(item => item.installment_number <= through && Date.parse(item.due_date) > paymentNow);
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
      const updated = await loadThroneDebts();
      if (!payload.duplicate) emitSoundEvent(updated?.find(contract => contract.id === activeContract.id)?.status === "completed" ? "debt_completed" : "debt_installment");
      setStatusText(payload.spent + " PM paid toward your contract.");
    } catch(error) { setStatusText(error instanceof Error ? error.message : "Payment could not be confirmed. Please retry."); }
    finally {setIsBusy(false);}
  };
  return (
    <ContractDocument kind="throne" recorded={Boolean(activeContract) && !showingDraft} status={activeContract && !showingDraft ? label(activeContract.status) : "Draft · Not signed"}>
      <div className="throne-agreement__body">
      {contracts.length > 1 ? <label className="throne-agreement__history">Contract archive<select value={activeContract?.id ?? ""} onChange={event => {setIsDrafting(false);setHistoryId(event.target.value);setPaymentThrough(0);setSelectedInstallmentId("");}}>{contracts.map(contract => <option key={contract.id} value={contract.id}>{contract.debt_code} · {label(contract.status)}</option>)}</select></label> : null}
      {activeContract && !showingDraft ? <>
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
            {canPay && payable.length ? <><label>Pay installments through<select aria-label="Pay installments through" value={through} disabled={isBusy} onChange={event => setPaymentThrough(Number(event.target.value))}>{payable.map(item => <option key={item.id} value={item.installment_number}>{item.installment_number === payable[0].installment_number ? "Next installment" : item.installment_number === payable[payable.length-1].installment_number ? "Full remaining balance" : "Through installment #"+item.installment_number} · {usd(payable.filter(row=>row.installment_number<=item.installment_number).reduce((sum,row)=>sum+getThroneDebtInstallmentRemaining(row),0))}</option>)}</select></label><p className="throne-agreement__quote">{pmCost} PM <span>reduces your debt by {usd(pmCost)}</span></p><p>Balance after payment: {money === null ? "—" : Math.max(0,money-pmCost)+" PM"}</p>{includesEarlyPayment ? <h4>Want to pay early?</h4> : null}<button type="button" disabled={disabled || isBusy || money === null || money<pmCost || !Number.isInteger(pmCost)} onClick={()=>void payPm()}>{isBusy ? "Processing…" : (includesEarlyPayment ? "Pay early · " : "Pay ")+pmCost+" PM"}</button>{money !== null && money<pmCost ? <p>Not enough PM for this payment.</p> : null}{!Number.isInteger(pmCost) ? <p>This payment contains cents. Use Throne or request a manual review.</p> : null}</> : <p>{hasReview ? "A payment is awaiting review. Please wait before paying again." : activeContract.status === "completed" ? "Your agreement is fulfilled. No balance remains." : "PM payments are available for active and overdue contracts."}</p>}
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
      {!openContract ? <details open={!activeContract || showingDraft} onToggle={event => { if (activeContract && !openContract) setIsDrafting(event.currentTarget.open); }} className="throne-agreement__request"><summary>{activeContract && !showingDraft ? "Request another debt contract" : "Draft your agreement"}</summary><p>Minimum $10 per week. Your request is reviewed before a contract begins. Pay approved installments with PM or Throne.</p>
        <div className={styles.draftForm}><div className={styles.form}>
        <ContractClause number="I" title="The terms of your promise">
        <div className="throne-agreement__draft">
          <label>Total commitment (USD)<input placeholder="Total USD" inputMode="numeric" disabled={disabled || isBusy || isTimeoutActive} value={totalAmountUsd} onChange={event=>setTotalAmountUsd(event.target.value)}/></label>
          <label>Repayment frequency<select disabled={disabled || isBusy || isTimeoutActive} value={repaymentFrequency} onChange={event=>setRepaymentFrequency(event.target.value as ThroneDebtFrequency)}><option value="weekly">Every week</option><option value="bi_weekly">Every 2 weeks</option><option value="monthly">Every 4 weeks</option></select></label>
          <label>Contract length<select aria-label="Contract length" disabled={disabled || isBusy || isTimeoutActive} value={contractLengthWeeks} onChange={event=>setContractLengthWeeks(event.target.value)}><option value="">Length</option>{THRONE_DEBT_LENGTH_OPTIONS.map(weeks=><option key={weeks} value={weeks}>{weeks} weeks</option>)}<option value="custom">Custom</option></select></label>
          {contractLengthWeeks === "custom" ? <label>Custom weeks<input inputMode="numeric" disabled={disabled || isBusy || isTimeoutActive} value={customLengthWeeks} onChange={event=>setCustomLengthWeeks(event.target.value)}/></label> : null}
        </div>
        {planValid ? <div className={styles.draftQuote}>
          <span>{plan.installmentAmountsUsd.length} installments <strong>{usd(Math.min(...plan.installmentAmountsUsd))}{Math.min(...plan.installmentAmountsUsd) !== Math.max(...plan.installmentAmountsUsd) ? "–"+usd(Math.max(...plan.installmentAmountsUsd)) : ""} each</strong></span>
          <span>Total commitment <strong>{usd(plan.totalAmountUsd)}</strong></span>
        </div> : null}
        <p className={styles.hint}>1 PM = $1. Throne payments with your TD code settle this agreement without adding PM. Payment dates are set after approval.</p>
        </ContractClause>
        {hasPlanInputs && !planValid ? <p className={styles.note}>Use a whole-dollar total, 4–104 weeks, and at least {usd(minimumInstallmentUsd)} per installment.</p> : null}
        <ContractClause number="II" title="A note with your promise"><label className={styles.field}>Your note (optional)<textarea maxLength={500} disabled={disabled || isBusy || isTimeoutActive} value={userNote} onChange={event=>setUserNote(event.target.value)}/></label></ContractClause>
        <div className={styles.signing}><p>Submit these terms for Principessa’s approval.</p><button className={styles.primary} type="button" disabled={disabled || isBusy || isTimeoutActive || !planValid} onClick={()=>void createThroneDebt()}>Submit Throne Debt Request</button></div>
        {isTimeoutActive ? <p>You cannot create new debt while your account is in timeout.</p> : null}
        </div></div>
      </details> : null}
      {statusText ? <p role="status" className="throne-agreement__notice">{statusText}</p> : null}
      </div>
    </ContractDocument>
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

    <ContractDocument kind="coin" recorded={Boolean(hasOpenDebtContract && active && petDebtContract)} status={active && hasOpenDebtContract ? "Active agreement" : showLockedState ? "Unavailable · Contract open" : "Draft · Not signed"}>
      {currentKind === "normal" ? <SignedBanner/> : null}
      {hasOpenDebtContract && active && petDebtContract ? <CoinAccount contract={petDebtContract} now={now} installmentNumber={debtInstallmentNumber} remaining={remainingDebtBalance} due={debtPaymentDue} missed={hasMissedInstallment} disabled={activeDebtControlsDisabled} busy={isPetActionPending("pet-debt-contract")} autoPay={isDebtAutoPayEnabled} onAutoPay={onDebtAutoPayChange} onPay={onPayDebtPeriod}/> : showLockedState ? <LockedDebtState accent="normal" blockingContractMessage={blockingContractMessage} petDebtContract={petDebtContract}/> : <>
        <div className={styles.draftForm}>
          <div className={styles.form}>
            <ContractClause number="I" title="The terms of your promise">
              <div className={styles.fields}>
                <ContractField label="Your contracted name"><select aria-label="Your contracted name" value={normalPetName} onChange={e=>onNormalPetNameChange(e.target.value)} disabled={contractCreationDisabled}>{DEBT_PET_NAMES.map(name=><option key={name}>{name}</option>)}</select></ContractField>
                <ContractField label="Repayment period"><select aria-label="Coin repayment period" value={normalDebtPeriodType} onChange={e=>onNormalDebtPeriodTypeChange(e.target.value as "weekly" | "monthly")} disabled={contractCreationDisabled}><option value="weekly">Weekly · every 7 days</option><option value="monthly">Monthly · every 30 days</option></select></ContractField>
                <ContractField label="Coins per installment"><input aria-label="Coin installment amount" inputMode="numeric" min={normalDebtMinimumPayment} placeholder={"Min "+normalDebtMinimumPayment.toLocaleString()} value={normalDebtAmount} onChange={e=>onNormalDebtAmountChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
                <ContractField label={"Duration in "+normalDebtDurationLimit.label.toLowerCase()}><input aria-label="Coin contract duration" inputMode="numeric" min={normalDebtDurationLimit.min} max={normalDebtDurationLimit.max} placeholder={normalDebtDurationLimit.min+"–"+normalDebtDurationLimit.max} value={normalDebtDuration} onChange={e=>onNormalDebtDurationChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
              </div>
              <p className={styles.hint}>Minimum {normalDebtMinimumPayment.toLocaleString()} Coins per {normalDebtPeriodType === "weekly" ? "week" : "month"}. Your first payment opens after one period.</p>
            </ContractClause>
            <ContractClause number="II" title="Your payment preferences">
              <PurchasePledgeCheckbox checked={normalPurchasePledge} disabled={contractCreationDisabled} onChange={onNormalPurchasePledgeChange}/>
              <div className={styles.autopay}><AutoPaymentSwitch disabled={contractControlsDisabled || hasOpenDebtContract} enabled={isDebtAutoPayEnabled} onChange={onDebtAutoPayChange}/><p className={styles.hint}>Optional. After the 48-hour grace period, auto payment can collect a full outstanding installment when your balance covers it.</p></div>
            </ContractClause>
            <DebtCapacitySummary amount={normalDebtAmount} duration={normalDebtDuration} capacity={capacityPreview} error={capacityPreviewError}/>
            <div className={styles.signing}><p>Signing starts your Coin Debt agreement with the terms above.</p><button type="button" className={styles.primary} onClick={onSign} disabled={contractCreationDisabled || isPetActionPending("pet-debt-contract")}>Sign Debt Contract</button></div>
            <details className={styles.disclosure}><summary>Let Principessa choose your terms</summary><p className={styles.hint}>Sign Random Debt immediately creates a contract with a random name, period, amount and duration. It does not fill in a draft.</p><button type="button" className={styles.secondary} onClick={onRandomDebtSign} disabled={contractCreationDisabled || isPetActionPending("pet-debt-contract")}>{isPetActionPending("pet-debt-contract") ? "Signing…" : "Sign Random Debt"}</button></details>
          </div>
        </div>
      </>}
    </ContractDocument>
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

    <ContractDocument kind="evil" recorded={Boolean(hasOpenDebtContract && active && petDebtContract)} status={active && hasOpenDebtContract ? petDebtContract?.status === "pending" ? "Awaiting approval" : "Active agreement" : showLockedState ? "Unavailable · Contract open" : "Draft · Not signed"}>
      {currentKind === "evil" ? <SignedBanner/> : null}
      {hasOpenDebtContract && active && petDebtContract ? <CoinAccount contract={petDebtContract} now={now} installmentNumber={debtInstallmentNumber} remaining={remainingDebtBalance} due={debtPaymentDue} missed={hasMissedInstallment} disabled={activeDebtControlsDisabled} busy={isPetActionPending("pet-debt-contract")} autoPay={isDebtAutoPayEnabled} onAutoPay={onDebtAutoPayChange} onPay={onPayDebtPeriod}/> : showLockedState ? <LockedDebtState accent="evil" blockingContractMessage={blockingContractMessage} petDebtContract={petDebtContract}/> : <>
        <div className={styles.draftForm}>
          <div className={styles.form}>
            <ContractClause number="I" title="The person making the promise">
              <div className={styles.fields}>
                <ContractField label="Full name"><input aria-label="Full name" placeholder="Name on your contract" value={evilFullName} onChange={e=>onEvilFullNameChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
                <ContractField label="Age"><input aria-label="Age" type="number" min={18} max={120} value={evilAge} onChange={e=>onEvilAgeChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
                <ContractField label="Timezone"><select aria-label="Timezone" value={evilTimezone} onChange={e=>onEvilTimezoneChange(e.target.value)} disabled={contractCreationDisabled}>{EVIL_DEBT_TIMEZONE_OPTIONS.map(zone=><option key={zone}>{zone}</option>)}</select></ContractField>
                <ContractField label="Personal note · optional"><textarea aria-label="Evil contract note" maxLength={240} placeholder="A note for Principessa" value={evilCustomNote} onChange={e=>onEvilCustomNoteChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
              </div>
            </ContractClause>
            <ContractClause number="II" title="The obligation you accept">
              <div className={styles.fields}>
                <ContractField label="Repayment period"><select aria-label="Evil repayment period" value={evilDebtPeriodType} onChange={e=>onEvilDebtPeriodTypeChange(e.target.value as "weekly" | "monthly")} disabled={contractCreationDisabled}><option value="weekly">Weekly · every 7 days</option><option value="monthly">Monthly · every 30 days</option></select></ContractField>
                <ContractField label="Coins per installment"><input aria-label="Evil installment amount" inputMode="numeric" min={evilDebtMinimumPayment} step={5000} placeholder={"Min "+evilDebtMinimumPayment.toLocaleString()} value={evilDebtAmount} onChange={e=>onEvilDebtAmountChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
                <ContractField label={"Duration in "+evilDebtDurationLimit.label.toLowerCase()}><input aria-label="Evil contract duration" inputMode="numeric" min={evilDebtDurationLimit.min} max={evilDebtDurationLimit.max} placeholder={evilDebtDurationLimit.min+"–"+evilDebtDurationLimit.max} value={evilDebtDuration} onChange={e=>onEvilDebtDurationChange(e.target.value)} disabled={contractCreationDisabled}/></ContractField>
              </div>
              <p className={styles.hint}>Minimum {evilDebtMinimumPayment.toLocaleString()} Coins per {evilDebtPeriodType === "weekly" ? "week" : "month"}. Principessa reviews this agreement before it begins.</p>
            </ContractClause>
            <ContractClause number="III" title="Your attachments & declarations">
              <label className={styles.upload}>Contract attachments · 1–8 BM images<input aria-label="Contract attachments" type="file" accept="image/*" multiple onChange={e=>void onEvilDebtImagesChange(e.target.files)} disabled={contractCreationDisabled}/><span className={styles.hint}>Up to 4 MB per image.</span></label>
              {evilImageError ? <p role="alert" className={styles.note}>{evilImageError}</p> : null}
              {evilImageUrls.length ? <div className={styles.uploads}>{evilImageUrls.map((url,i)=><Image unoptimized width={160} height={160} src={url} alt={"Contract attachment "+(i+1)} key={url.slice(0,32)+i}/>)}</div> : null}
              <div className={styles.consent}><p>Declaration 1 · Type this statement exactly:</p><p>{EVIL_CONSENT_PRIMARY_TEXT}</p><textarea aria-label="First consent statement" placeholder="Type declaration 1 here" value={evilConsentPrimary} onChange={e=>onEvilConsentPrimaryChange(e.target.value)} disabled={contractCreationDisabled}/></div>
              <div className={styles.consent}><p>Declaration 2 · Type this statement exactly:</p><p>{EVIL_CONSENT_SECONDARY_TEXT}</p><textarea aria-label="Second consent statement" placeholder="Type declaration 2 here" value={evilConsentSecondary} onChange={e=>onEvilConsentSecondaryChange(e.target.value)} disabled={contractCreationDisabled}/></div>
            </ContractClause>
            <ContractClause number="IV" title="Your payment preferences"><PurchasePledgeCheckbox checked={evilPurchasePledge} disabled={contractCreationDisabled} onChange={onEvilPurchasePledgeChange}/><div className={styles.autopay}><AutoPaymentSwitch disabled={contractControlsDisabled || hasOpenDebtContract} enabled={isDebtAutoPayEnabled} onChange={onDebtAutoPayChange}/><p className={styles.hint}>Optional. After the 48-hour grace period, auto payment can collect a full outstanding installment when your balance covers it.</p></div></ContractClause>
            <DebtCapacitySummary amount={evilDebtAmount} duration={evilDebtDuration} capacity={capacityPreview} error={capacityPreviewError}/>
            <div className={styles.signing}><p>Review every declaration. Signing asks for final confirmation, then sends the agreement for approval.</p><button type="button" className={styles.primary} onClick={onSign} disabled={contractCreationDisabled || isPetActionPending("pet-debt-contract")}>Sign Evil Debt Contract</button></div>
          </div>
        </div>
      </>}
    </ContractDocument>
  );
}

function CoinAccount({ contract, now, installmentNumber, due, missed, disabled, busy, autoPay, onAutoPay, onPay }: {
  contract: PetDebtContract; now: number; installmentNumber: number; remaining: number;
  due: boolean; missed: boolean; disabled: boolean; busy: boolean; autoPay: boolean;
  onAutoPay: (enabled: boolean) => void; onPay: () => void;
}) {
  const pending = contract.status === "pending";
  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return <>
    <div className={styles.columns}>
      <div className={styles.form}>
        <ContractClause number="I" title="Your recorded agreement">
          <dl className={styles.record}>
            <div><dt>Contracted name</dt><dd>{contract.pet_name}</dd></div>
            <div><dt>Reference</dt><dd>{contract.id.slice(0,8).toUpperCase()}</dd></div>
            <div><dt>Signed</dt><dd>{date(contract.created_at)}</dd></div>
            <div><dt>Repayment</dt><dd>Every {contract.period_type === "weekly" ? "7" : "30"} days</dd></div>
            {contract.contract_type === "evil" ? <><div><dt>Full name</dt><dd>{contract.full_name ?? "Recorded"}</dd></div><div><dt>Timezone</dt><dd>{contract.timezone ?? "Recorded"}</dd></div></> : null}
          </dl>
          {pending ? <p className={styles.note}>Your agreement is awaiting Principessa’s approval. The repayment schedule begins after approval.</p> : <p className={styles.hint}>Contract period: {date(contract.started_at)} – {date(contract.ends_at)}.</p>}
        </ContractClause>
        <ContractClause number="II" title={pending ? "Awaiting the court" : "Your current installment"}>
          {pending ? <p className={styles.hint}>Your submission is recorded. Payment controls will appear when the agreement is approved.</p> : <>
            <dl className={styles.record}>
              <div><dt>Installment</dt><dd>{installmentNumber} of {contract.duration_periods}</dd></div>
              <div><dt>Amount still due</dt><dd>{getCurrentInstallmentRemaining(contract).toLocaleString()} Coins</dd></div>
              <div><dt>Payment opens</dt><dd>{due ? "Open now" : formatRemaining(contract.next_due_at, now)}</dd></div>
              <div><dt>Missed periods</dt><dd>{contract.missed_periods}</dd></div>
            </dl>
            <p className={styles.hint}>Only the current installment can be paid. If your Coins cover part of it, that amount reduces the balance; the period is settled when it is fully paid.</p>
            <div className={styles.autopay}><AutoPaymentSwitch enabled={autoPay} disabled={disabled || busy} onChange={onAutoPay}/><p className={styles.hint}>When enabled, collection can run after the 48-hour grace period if your balance covers the full outstanding installment.</p></div>
            <div className={styles.signing}><p>{due ? "Apply your available Coins to this installment." : "Future installments remain locked until their scheduled date."}</p><button className={styles.primary} type="button" disabled={disabled || !due || busy} onClick={onPay}>{busy ? "Saving…" : !due ? "Next installment locked" : missed ? "Catch up missed installment" : "Pay current installment"}</button></div>
          </>}
        </ContractClause>
        {contract.custom_note ? <p className={styles.note}>{contract.custom_note}</p> : null}
      </div>

    </div>
    <ContractSignature name={contract.full_name || contract.pet_name} state={pending ? "SIGNED · AWAITING APPROVAL" : "SIGNED · ACTIVE AGREEMENT"}/>
  </>;
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
<label className={styles.choice}><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span>If I cannot cover a scheduled payment, I may purchase coins to complete it. I understand that a missed payment can result in a 7-day timeout only after admin review.<small>Optional and unchecked by default. Accepting it doubles the affordability limit (+100%).</small></span></label>
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
      <p role="alert" className={styles.note}>
        {error}
      </p>
    );
  }

  if (!capacity) {
    return (
      <p className={styles.hint}>
        Enter a duration to see how this commitment fits your balance.
      </p>
    );
  }

  const installmentAmount = Math.max(0, Math.floor(Number(amount)));
  const durationPeriods = Math.max(0, Math.floor(Number(duration)));
  const requestedTotal = installmentAmount * durationPeriods;
  const reviewedExposure = installmentAmount * capacity.evaluatedPeriods;
  const overLimit = reviewedExposure > capacity.totalLimit;

  return (
    <details className={styles.disclosure} open={overLimit}>
      <summary>Affordability · {overLimit ? "Above your current limit" : "Within your current limit"}</summary>
      <dl className={styles.facts}>
        <div><dt>Coin balance</dt><dd>{capacity.balanceCoins.toLocaleString()}</dd></div>
        <div><dt>75% balance capacity</dt><dd>{capacity.balanceComponent.toLocaleString()}</dd></div>
        <div><dt>Reliable period income</dt><dd>{capacity.reliablePeriodIncome.toLocaleString()}</dd></div>
        <div><dt>Reviewed periods</dt><dd>{capacity.evaluatedPeriods}</dd></div>
        <div><dt>Affordability limit</dt><dd>{capacity.totalLimit.toLocaleString()}</dd></div>
        <div><dt>Near-term commitment</dt><dd>{reviewedExposure.toLocaleString()}</dd></div>
        <div><dt>Full contract total</dt><dd>{requestedTotal.toLocaleString()}</dd></div>
        <div><dt>Optional pledge boost</dt><dd>{capacity.purchasePledgeBoost.toLocaleString()}</dd></div>
      </dl>
      <p className={styles.hint}>The affordability check covers the reviewed periods above; your full contract total is shown separately.</p>
    </details>
  );
}

function LockedDebtState({
  blockingContractMessage,
  petDebtContract,
}: {
  accent: "normal" | "evil";
  blockingContractMessage: string | null;
  petDebtContract: PetDebtContract;
}) {


  return (
<div className={styles.locked}><Image src="/principessa-ui/generated/principessa-debt-contract.webp" width={80} height={106} alt="Principessa holding a contract"/><div><h4>One promise at a time.</h4><p>{blockingContractMessage ?? "Another Coin or Evil Debt agreement is already open."}</p><p className={styles.note}>{petDebtContract.contract_type === "evil" ? "Evil Debt" : "Coin Debt"} · {petDebtContract.status === "pending" ? "Awaiting approval" : "Active"} · {petDebtContract.debt_amount.toLocaleString()} Coins / {petDebtContract.period_type === "weekly" ? "week" : "month"}</p><p>This agreement becomes available when the current one is completed or resolved by Principessa.</p></div></div>
  );
}

function SignedBanner() {
  return (
<div className={styles.signed} role="status"><Image src={DEBT_SIGNING_IMAGE_PATH} width={36} height={48} alt=""/><div><strong>Contract signed.</strong><p>Your promise is recorded.</p></div></div>
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
<button type="button" aria-pressed={enabled} className={styles.toggle} disabled={disabled} onClick={()=>onChange(!enabled)}><span>Auto payment</span><span className={styles.switch} aria-hidden="true"><i/></span><strong>{enabled ? "ON" : "OFF"}</strong></button>
  );
}
