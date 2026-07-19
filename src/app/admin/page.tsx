"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";
import { EVENT_TEMPLATES, FIRST_DAY_EVENT_TEMPLATE, type RandomEvent } from "@/lib/events";
import type { ThroneDebtContract } from "@/lib/throne-debt";

type AdminIrlTask = {
  id: string;
  user_id: string;
  username: string;
  task_label: string;
  task_description: string | null;
  wheel_index: number;
  cost_coins: number;
  status: string;
  due_at: string | null;
  penalty_timeout_minutes: number | null;
  completed_at: string | null;
  reviewed_at: string | null;
  shamed_at: string | null;
  assigned_at: string;
  timeout_until: string | null;
};

type TimedOutUser = {
  id: string;
  username: string;
  timeout_until: string;
  timeout_reason?: string | null;
  shame_count: number | null;
};

type MaxAffectionUser = {
  id: string;
  username: string;
  affection: number;
  tribute_total: number;
  updated_at: string | null;
};

type AdminPetTask = {
  id: string;
  user_id: string;
  username: string;
  task_id: string;
  reward_score: number;
  status: string;
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  pet_score: number;
};

type AdminPetTaskLog = {
  id: string;
  task_row_id: string | null;
  user_id: string;
  username_snapshot: string | null;
  task_id: string;
  status: "queued" | "executed" | "reverted" | "cleared";
  reward_score_delta: number;
  coin_total_delta: number;
  throne_base_coin_amount: number;
  throne_give_bonus_amount: number;
  throne_task_bonus_amount: number;
  devotion_delta: number;
  pending_action_id: string | null;
  transaction_ids: string[] | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type AdminDebtContract = {
  id: string;
  user_id: string;
  username: string;
  pet_name: string;
  contract_type?: "normal" | "evil";
  current_installment_remaining?: number;
  period_type: "weekly" | "monthly";
  debt_amount: number;
  duration_periods: number;
  paid_periods: number;
  missed_periods: number;
  random_generated?: boolean;
  status: string;
  started_at: string;
  next_due_at: string;
  ends_at: string;
  declared_age?: number | null;
  full_name?: string | null;
  timezone?: string | null;
  custom_note?: string | null;
  consent_primary?: boolean | null;
  consent_secondary?: boolean | null;
  image_urls?: string[] | null;
  purchase_pledge?: boolean;
  capacity_snapshot?: {
    balanceCoins?: number;
    balanceComponent?: number;
    baseTotalLimit?: number;
    evaluatedPeriods?: number;
    incomeComponent?: number;
    purchasePledgeBoost?: number;
    reliablePeriodIncome?: number;
    requestedExposure?: number;
    requestedTotal?: number;
    totalLimit?: number;
  } | null;
  admin_review_required?: boolean;
  overdue_since?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
  current_coins?: number;
  debt_timeout_active?: boolean;
  timeout_reason?: string | null;
  timeout_until?: string | null;
};

type AdminThroneDebtContract = ThroneDebtContract & {
  username?: string;
};

type AdminEvent = RandomEvent & {
  created_at?: string;
};

type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string | null;
};

type CaseOpening = {
  id: string;
  crateName: string;
  itemName: string;
  itemRarity: string;
  itemChancePercent: number | null;
  itemSellValue: number | null;
  openedAt: string;
};

type CaseOpener = {
  id: string;
  username: string;
  avatarUrl: string | null;
  usernameStyle?: { color?: string; textShadow?: string };
  lastOpenedAt: string;
  totalOpens: number;
  totalCoinsWon: number;
  recentOpenings: CaseOpening[];
};

type AdminTabKey =
  | "announcements"
  | "caseOpeners"
  | "console"
  | "debt"
  | "events"
  | "irlTasks"
  | "maxAffection"
  | "petTasks"
  | "timeouts";

function getAdminDebtCurrentInstallmentNumber(contract: Pick<AdminDebtContract, "duration_periods" | "paid_periods">) {
  return Math.min(contract.paid_periods + 1, contract.duration_periods);
}

function getAdminDebtCurrentInstallmentRemaining(
  contract: Pick<AdminDebtContract, "current_installment_remaining" | "debt_amount">,
) {
  const currentInstallmentRemaining = Math.floor(Number(contract.current_installment_remaining ?? 0));
  return currentInstallmentRemaining > 0 ? currentInstallmentRemaining : Math.max(0, contract.debt_amount);
}

function getAdminDebtRemainingBalance(
  contract: Pick<AdminDebtContract, "current_installment_remaining" | "debt_amount" | "duration_periods" | "paid_periods">,
) {
  const currentInstallmentRemaining = getAdminDebtCurrentInstallmentRemaining(contract);
  return (
    currentInstallmentRemaining +
    Math.max(0, contract.duration_periods - contract.paid_periods - 1) * contract.debt_amount
  );
}

type AdminLoadKey =
  | "announcements"
  | "caseOpeners"
  | "debt"
  | "events"
  | "irlTasks"
  | "maxAffection"
  | "petTaskLogs"
  | "petTasks"
  | "timeouts";

function formatRemaining(target: string, now: number) {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const totalMinutes = Math.ceil(remaining / 60000);
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

function getEventAdminStatus(event: RandomEvent, now: number) {
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();

  if (Number.isFinite(endsAt) && endsAt <= now) {
    return {
      label: "Expired",
      tone: "border-zinc-200/15 bg-zinc-500/10 text-zinc-100",
    } as const;
  }

  if (Number.isFinite(startsAt) && startsAt > now) {
    return {
      label: "Scheduled",
      tone: "border-sky-200/15 bg-sky-500/10 text-sky-100",
    } as const;
  }

  if (event.active) {
    return {
      label: "Active",
      tone: "border-yellow-200/20 bg-yellow-400/10 text-yellow-50",
    } as const;
  }

  return {
    label: "Inactive",
    tone: "border-white/10 bg-white/[0.04] text-zinc-200",
  } as const;
}

export default function AdminPage() {
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [command, setCommand] = useState("/");
  const [activeTab, setActiveTab] = useState<AdminTabKey>("console");
  const [debtSubTab, setDebtSubTab] = useState<"normal" | "evil" | "throne">("normal");
  const [irlTasks, setIrlTasks] = useState<AdminIrlTask[]>([]);
  const [petTasks, setPetTasks] = useState<AdminPetTask[]>([]);
  const [petTaskLogs, setPetTaskLogs] = useState<AdminPetTaskLog[]>([]);
  const [debtContracts, setDebtContracts] = useState<AdminDebtContract[]>([]);
  const [throneDebtContracts, setThroneDebtContracts] = useState<AdminThroneDebtContract[]>([]);
  const [expandedEvilDebtId, setExpandedEvilDebtId] = useState<string | null>(null);
  const [previewDebtImage, setPreviewDebtImage] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [eventTemplateKey, setEventTemplateKey] = useState(FIRST_DAY_EVENT_TEMPLATE.key);
  const [announcementTitle, setAnnouncementTitle] = useState("Announcement");
  const [announcementBody, setAnnouncementBody] = useState(
    "Higher or Lower and Case Opening have swapped places. Please check the new task positions before playing.",
  );
  const [announcementDays, setAnnouncementDays] = useState("3");
  const [timedOutUsers, setTimedOutUsers] = useState<TimedOutUser[]>([]);
  const [maxAffectionUsers, setMaxAffectionUsers] = useState<MaxAffectionUser[]>([]);
  const [caseOpeners, setCaseOpeners] = useState<CaseOpener[]>([]);
  const [expandedCaseOpenerId, setExpandedCaseOpenerId] = useState<string | null>(null);
  const [timeoutInputs, setTimeoutInputs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [defneMessage, setDefneMessage] = useState("Admin ledger ready. Be precise.");
  const [busyRequestCount, setBusyRequestCount] = useState(0);
  const [loadingSections, setLoadingSections] = useState<Record<AdminLoadKey, boolean>>({
    announcements: false,
    caseOpeners: false,
    debt: false,
    events: false,
    irlTasks: false,
    maxAffection: false,
    petTaskLogs: false,
    petTasks: false,
    timeouts: false,
  });
  const [loadedSections, setLoadedSections] = useState<Record<AdminLoadKey, boolean>>({
    announcements: false,
    caseOpeners: false,
    debt: false,
    events: false,
    irlTasks: false,
    maxAffection: false,
    petTaskLogs: false,
    petTasks: false,
    timeouts: false,
  });
  const [adminNow, setAdminNow] = useState(() => Date.now());
  const isBusy = busyRequestCount > 0;
  const setIsBusy = (next: boolean) => {
    setBusyRequestCount((current) => {
      if (next) {
        return current + 1;
      }

      return Math.max(0, current - 1);
    });
  };
  const setSectionLoading = (key: AdminLoadKey, next: boolean) => {
    setLoadingSections((current) => ({ ...current, [key]: next }));
  };
  const markSectionLoaded = (key: AdminLoadKey) => {
    setLoadedSections((current) => ({ ...current, [key]: true }));
  };

  useEffect(() => {
    const timer = window.setInterval(() => setAdminNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  const loadIrlTasks = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("irlTasks", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/irl-tasks", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        tasks?: AdminIrlTask[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "IRL task list failed.");
      }

      setIrlTasks(result.tasks ?? []);
      markSectionLoaded("irlTasks");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "IRL task list failed.");
    } finally {
      setSectionLoading("irlTasks", false);
    }
  };

  const loadTimeouts = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("timeouts", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/timeouts", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        users?: TimedOutUser[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Timeout list failed.");
      }

      setTimedOutUsers(result.users ?? []);
      markSectionLoaded("timeouts");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Timeout list failed.");
    } finally {
      setSectionLoading("timeouts", false);
    }
  };

  const loadMaxAffectionUsers = async ({
    keepStatus = false,
  }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("maxAffection", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/max-affection", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        users?: MaxAffectionUser[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Max affection list failed.");
      }

      setMaxAffectionUsers(result.users ?? []);
      markSectionLoaded("maxAffection");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Max affection list failed.");
    } finally {
      setSectionLoading("maxAffection", false);
    }
  };

  const loadCaseOpeners = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("caseOpeners", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/recent-case-openings", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        openers?: CaseOpener[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Recent case openers failed.");
      }

      setCaseOpeners(result.openers ?? []);
      markSectionLoaded("caseOpeners");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recent case openers failed.");
    } finally {
      setSectionLoading("caseOpeners", false);
    }
  };

  const loadPetTasks = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("petTasks", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/pet-tasks", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        tasks?: AdminPetTask[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Pet task list failed.");
      }

      setPetTasks(result.tasks ?? []);
      markSectionLoaded("petTasks");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pet task list failed.");
    } finally {
      setSectionLoading("petTasks", false);
    }
  };

  const loadPetTaskLogs = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("petTaskLogs", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/pet-task-logs", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        logs?: AdminPetTaskLog[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Pet task log list failed.");
      }

      setPetTaskLogs(result.logs ?? []);
      markSectionLoaded("petTaskLogs");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pet task log list failed.");
    } finally {
      setSectionLoading("petTaskLogs", false);
    }
  };

  const loadDebtContracts = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("debt", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/debt-contracts", {
        body: JSON.stringify({ action: "expireOverdue" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        contracts?: AdminDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Debt contract list failed.");
      }

      setDebtContracts(result.contracts ?? []);

      const throneResponse = await fetch("/api/admin/throne-debts", {
        body: JSON.stringify({ action: "list" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const throneResult = (await throneResponse.json()) as {
        contracts?: AdminThroneDebtContract[];
        error?: string;
      };

      if (!throneResponse.ok) {
        throw new Error(throneResult.error ?? "Throne Debt list failed.");
      }

      setThroneDebtContracts(throneResult.contracts ?? []);
      markSectionLoaded("debt");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Debt contract list failed.");
    } finally {
      setSectionLoading("debt", false);
    }
  };

  const loadEvents = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("events", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        events?: AdminEvent[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Event list failed.");
      }

      setEvents(result.events ?? []);
      markSectionLoaded("events");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Event list failed.");
    } finally {
      setSectionLoading("events", false);
    }
  };

  const loadAnnouncements = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
    if (!isAdmin) {
      return;
    }

    setSectionLoading("announcements", true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/announcements", { cache: "no-store" });
      const result = (await response.json()) as {
        announcements?: AdminAnnouncement[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Announcement list failed.");
      }

      setAnnouncements(result.announcements ?? []);
      markSectionLoaded("announcements");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Announcement list failed.");
    } finally {
      setSectionLoading("announcements", false);
    }
  };

  const renderEventCard = (event: AdminEvent) => {
    const isExpired = new Date(event.ends_at).getTime() <= adminNow;
    const eventStatus = getEventAdminStatus(event, adminNow);

    return (
      <article
        className={`rounded-2xl border p-3 ${
          event.active ? "border-yellow-200/30 bg-yellow-400/10" : "border-white/10 bg-black/35"
        }`}
        key={event.id}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">{event.name}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{event.description}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {new Date(event.starts_at).toLocaleString()} - {new Date(event.ends_at).toLocaleString()}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${eventStatus.tone}`}
              >
                {eventStatus.label}
              </span>
              <span className="text-xs font-bold text-yellow-100/80">
                {event.effect.type} x{event.effect.multiplier}
                {event.effect.speechAvatarId ? ` - ${event.effect.speechAvatarId}` : ""}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {isExpired ? (
              <span className="rounded-2xl border border-zinc-200/15 bg-zinc-500/10 px-3 py-2 text-xs font-black uppercase text-zinc-100">
                Ended
              </span>
            ) : !event.active ? (
              <button
                className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onClick={() => void handleEventAction("activate", event.id)}
                type="button"
              >
                Activate
              </button>
            ) : (
              <button
                className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onClick={() => void handleEventAction("end", event.id)}
                type="button"
              >
                End
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const handleEventAction = async (
    action: "activate" | "create" | "end",
    eventId?: string,
  ) => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/events", {
        body: JSON.stringify({
          action,
          eventId,
          templateKey: action === "create" ? eventTemplateKey : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Event action failed.");
      }

      setStatus(
        action === "create"
          ? "Event created and activated."
          : action === "activate"
            ? "Event activated."
            : "Event ended.",
      );
      setDefneMessage("Event ledger updated.");
      await loadEvents({ keepStatus: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Event action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnnouncementAction = async (
    action: "create" | "end",
    announcementId?: string,
  ) => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/announcements", {
        body: JSON.stringify({
          action,
          announcementId,
          body: action === "create" ? announcementBody : undefined,
          days: action === "create" ? announcementDays : undefined,
          title: action === "create" ? announcementTitle : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Announcement action failed.");
      }

      setStatus(action === "create" ? "Announcement published." : "Announcement ended.");
      setDefneMessage("Announcement ledger updated.");
      await loadAnnouncements({ keepStatus: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Announcement action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDebtAdminAction = async (
    action: "applyTimeout" | "clearTimeout" | "closeNoRefund",
    contractId: string,
  ) => {
    if (!isAdmin) {
      return;
    }

    const actionLabel =
      action === "applyTimeout"
        ? "apply the 7-day Debt Timeout"
        : action === "clearTimeout"
          ? "clear the Debt Timeout"
          : "close this debt without refund or penalty";

    if (!window.confirm(`Confirm: ${actionLabel}?`)) {
      return;
    }

    const reason = window.prompt("Admin reason / audit note") ?? "";
    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/debt-contracts", {
        body: JSON.stringify({ action, contractId, reason }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        contracts?: AdminDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Debt admin action failed.");
      }

      setDebtContracts(result.contracts ?? []);
      setStatus(`Debt admin action completed: ${actionLabel}.`);
      setDefneMessage("Debt state updated. The action was recorded in the admin audit ledger.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Debt admin action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleApproveEvilDebtContract = async (contractId: string) => {
    if (!isAdmin) {
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/debt-contracts", {
        body: JSON.stringify({ action: "approveEvil", contractId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        contracts?: AdminDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Evil Debt approval failed.");
      }

      setDebtContracts(result.contracts ?? []);
      setStatus("Evil Debt Contract approved.");
      setDefneMessage("Evil debt approved. The repayment schedule is active.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evil Debt approval failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleThroneDebtAction = async (payload: {
    action:
      | "approve_contract"
      | "approve_installment_payment"
      | "apply_throne_debt_timeout"
      | "cancel_contract"
      | "lift_timeout"
      | "mark_defaulted"
      | "pause_contract"
      | "reject_contract"
      | "reject_installment_payment"
      | "resume_contract";
    adminNote?: string;
    contractId?: string;
    installmentId?: string;
    rejectionReason?: string;
    reviewId?: string;
  }) => {
    if (!isAdmin) {
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/throne-debts", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        contracts?: AdminThroneDebtContract[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Throne Debt action failed.");
      }

      setThroneDebtContracts(result.contracts ?? []);
      setStatus("Throne Debt action completed.");
      setDefneMessage("Throne Debt ledger updated. Manual review stayed authoritative.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Throne Debt action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      setIsCheckingAdmin(true);

      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as {
          error?: string;
          isAdmin?: boolean;
        } | null;
        const adminAllowed = response.ok && result?.isAdmin === true;

        if (mounted) {
          setIsAdmin(adminAllowed);
          if (!adminAllowed) {
            setStatus(result?.error ?? "Admin access required.");
          }
        }
      } catch (error) {
        console.error("Admin session check failed", error);
        if (mounted) {
          setIsAdmin(false);
          setStatus("Admin access required.");
        }
      } finally {
        if (mounted) {
          setIsCheckingAdmin(false);
        }
      }
    };

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadIrlTasks({ keepStatus: true });
      void loadDebtContracts({ keepStatus: true });
      void loadTimeouts({ keepStatus: true });
    }, 120);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

  const handleRunCommand = async () => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const trimmedCommand = command.trim();
      const response = await fetch("/api/admin/give", {
        body: JSON.stringify({ command: trimmedCommand }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; message?: string; pending?: boolean; actionId?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Admin command failed.");
      }

      if (result.pending) {
        setStatus(`Pending Companion approval: ${result.message ?? result.actionId}`);
        setDefneMessage("Command sent to Companion App for two-step approval. Check your phone.");
        setIsBusy(false);
        return;
      }

      setStatus(result.message ?? "Command completed.");
      setDefneMessage(
        trimmedCommand.startsWith("/timeout remove")
          ? "Timeout removed. The ledger is clean for now."
          : trimmedCommand.startsWith("/timeout")
            ? "Timeout applied. Discipline looks good in the ledger."
            : trimmedCommand.startsWith("/add")
              ? "Coins added quietly. No tribute spectacle."
            : trimmedCommand.startsWith("/drain")
              ? "Coins drained. The loss has been recorded."
            : trimmedCommand.startsWith("/title")
              ? "Prestige title granted."
            : "Coins added. Try not to waste my generosity.",
      );

      if (trimmedCommand.startsWith("/give")) {
        window.localStorage.setItem("vault_recent_tribute_refresh", String(Date.now()));
      }

      if (trimmedCommand.startsWith("/timeout")) {
        await loadTimeouts({ keepStatus: true });
        await loadIrlTasks({ keepStatus: true });
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Invalid command. Use: /give 500 @username",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleIrlTaskReview = async (
    taskId: string,
    action: "approve" | "cancelShame" | "excuse",
  ) => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/irl-tasks", {
        body: JSON.stringify({ action, taskId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "IRL task review failed.");
      }

      setStatus(result.message ?? "IRL task reviewed.");
      setDefneMessage(
        action === "approve"
          ? "Approved. A little affection has been granted."
          : action === "cancelShame"
            ? "Task failed manually. The fail count has been recorded."
            : "Cleared through Throne. No affection and no timeout.",
      );
      await loadIrlTasks({ keepStatus: true });
      await loadTimeouts({ keepStatus: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "IRL task review failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePetTaskReview = async (taskId: string, action: "approve" | "reject") => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/pet-tasks", {
        body: JSON.stringify({ action, taskId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        tasks?: AdminPetTask[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Pet task review failed.");
      }

      setPetTasks(result.tasks ?? []);
      setStatus(result.message ?? "Pet task reviewed.");
      await loadPetTaskLogs({ keepStatus: true });
      setDefneMessage(
        action === "approve"
          ? (result.message ?? "Pet task approved. Progress has been granted.")
          : "Pet task rejected. Standards matter.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pet task review failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePetTaskLogAction = async (logId: string, action: "clear" | "revert") => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/pet-task-logs", {
        body: JSON.stringify({ action, logId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        logs?: AdminPetTaskLog[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Pet task log action failed.");
      }

      setPetTaskLogs(result.logs ?? []);
      setStatus(result.message ?? "Pet task log updated.");
      setDefneMessage(
        action === "revert"
          ? "Approval reverted. The ledger has been corrected."
          : "Log marked correct. The ledger can breathe again.",
      );
      await loadPetTasks({ keepStatus: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pet task log action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleTimeoutAction = async (
    userId: string,
    action: "cancel" | "change",
    duration?: string,
  ) => {
    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/timeouts", {
        body: JSON.stringify({ action, userId, duration }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        users?: TimedOutUser[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Timeout action failed.");
      }

      setTimedOutUsers(result.users ?? []);
      setStatus(result.message ?? "Timeout updated.");
      setDefneMessage(
        action === "cancel"
          ? "Timeout removed. The ledger is clean for now."
          : "Timeout duration changed. Precision suits power.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Timeout action failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const openAdminTab = (key: AdminTabKey) => {
    setActiveTab(key);

    switch (key) {
      case "irlTasks":
        if (!loadedSections.irlTasks && !loadingSections.irlTasks) {
          void loadIrlTasks();
        }
        break;
      case "caseOpeners":
        if (!loadedSections.caseOpeners && !loadingSections.caseOpeners) {
          void loadCaseOpeners();
        }
        break;
      case "petTasks":
        if (!loadedSections.petTasks && !loadingSections.petTasks) {
          void loadPetTasks();
        }
        if (!loadedSections.petTaskLogs && !loadingSections.petTaskLogs) {
          void loadPetTaskLogs({ keepStatus: true });
        }
        break;
      case "debt":
        if (!loadedSections.debt && !loadingSections.debt) {
          void loadDebtContracts();
        }
        break;
      case "events":
        if (!loadedSections.events && !loadingSections.events) {
          void loadEvents();
        }
        break;
      case "announcements":
        if (!loadedSections.announcements && !loadingSections.announcements) {
          void loadAnnouncements();
        }
        break;
      case "timeouts":
        if (!loadedSections.timeouts && !loadingSections.timeouts) {
          void loadTimeouts();
        }
        break;
      case "maxAffection":
        if (!loadedSections.maxAffection && !loadingSections.maxAffection) {
          void loadMaxAffectionUsers();
        }
        break;
      default:
        break;
    }
  };

  const pendingIrlTaskCount = irlTasks.filter((task) => task.status === "pending").length;
  const pendingPetTaskCount = petTasks.filter((task) => task.status === "pending").length;
  const pendingEvilDebtCount = debtContracts.filter(
    (contract) => contract.contract_type === "evil" && contract.status === "pending",
  ).length;
  const pendingThroneDebtCount = throneDebtContracts.filter((contract) =>
    contract.status === "pending_review" ||
    contract.status === "timeout" ||
    (contract.payment_reviews ?? []).some((review) => review.status === "pending"),
  ).length;
  const liveDebtCount = debtContracts.filter((contract) =>
    ["active", "pending"].includes(contract.status),
  ).length + throneDebtContracts.filter((contract) =>
    ["pending_review", "active", "overdue", "timeout", "paused"].includes(contract.status),
  ).length;
  const activeTimeoutCount = timedOutUsers.filter(
    (user) => new Date(user.timeout_until).getTime() > adminNow,
  ).length;
  const activeEventCount = events.filter((event) => {
    const endsAt = new Date(event.ends_at).getTime();
    return event.active && (!Number.isFinite(endsAt) || endsAt > adminNow);
  }).length;
  const activeAnnouncementCount = announcements.filter((announcement) => {
    const endsAt = new Date(announcement.ends_at).getTime();
    return announcement.active && (!Number.isFinite(endsAt) || endsAt > adminNow);
  }).length;
  const adminTabs = [
    {
      key: "console",
      label: "Command Console",
      eyebrow: "Direct actions",
      description: "Run manual commands and privileged adjustments.",
      countLabel: command.trim() ? "1" : "0",
      tone: "from-fuchsia-500/16 via-pink-500/10 to-transparent border-fuchsia-300/18",
    },
    {
      key: "caseOpeners",
      label: "Case Openers",
      eyebrow: "Recent activity",
      description: "Track the latest case-opening momentum.",
      countLabel: loadedSections.caseOpeners ? String(caseOpeners.length) : "0",
      tone: "from-cyan-500/16 via-sky-500/10 to-transparent border-cyan-300/18",
    },
    {
      key: "irlTasks",
      label: "IRL Tasks",
      eyebrow: "Manual review",
      description: "Review assigned wheel tasks and shame-state outcomes.",
      countLabel: loadedSections.irlTasks ? String(pendingIrlTaskCount) : "0",
      tone: "from-pink-500/16 via-fuchsia-500/10 to-transparent border-pink-300/18",
    },
    {
      key: "petTasks",
      label: "Pet Tasks",
      eyebrow: "Submission queue",
      description: "Approve pet tasks and watch throne logs.",
      countLabel: loadedSections.petTasks ? String(pendingPetTaskCount) : "0",
      tone: "from-rose-500/16 via-red-500/10 to-transparent border-rose-300/18",
    },
    {
      key: "debt",
      label: "Debt Contracts",
      eyebrow: "Risk control",
      description: "Manage normal and evil debt flows in one place.",
      countLabel: loadedSections.debt ? String(liveDebtCount) : "0",
      tone: "from-red-500/16 via-rose-500/10 to-transparent border-red-300/18",
    },
    {
      key: "events",
      label: "Events",
      eyebrow: "Global modifiers",
      description: "Schedule and rotate limited-time global bonuses.",
      countLabel: loadedSections.events ? String(activeEventCount) : "0",
      tone: "from-amber-500/16 via-yellow-500/10 to-transparent border-yellow-300/18",
    },
    {
      key: "announcements",
      label: "Announcements",
      eyebrow: "Homepage banner",
      description: "Publish and retire public-facing messages.",
      countLabel: loadedSections.announcements ? String(activeAnnouncementCount) : "0",
      tone: "from-pink-500/16 via-rose-500/10 to-transparent border-pink-300/18",
    },
    {
      key: "timeouts",
      label: "Active Timeouts",
      eyebrow: "Discipline",
      description: "Adjust or clear currently timed-out users.",
      countLabel: loadedSections.timeouts ? String(activeTimeoutCount) : "0",
      tone: "from-violet-500/16 via-fuchsia-500/10 to-transparent border-violet-300/18",
    },
    {
      key: "maxAffection",
      label: "100 Affection",
      eyebrow: "High-value users",
      description: "Watch who hit Principessa's maximum mood.",
      countLabel: loadedSections.maxAffection ? String(maxAffectionUsers.length) : "0",
      tone: "from-emerald-500/16 via-teal-500/10 to-transparent border-emerald-300/18",
    },
  ] as const satisfies ReadonlyArray<{
    countLabel: string;
    description: string;
    eyebrow: string;
    key: AdminTabKey;
    label: string;
    tone: string;
  }>;
  if (isCheckingAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06030a] px-4 text-pink-100">
        <div className="rounded-[2rem] border border-pink-200/20 bg-black/55 px-6 py-5 shadow-[0_0_44px_rgba(236,72,153,0.16)]">
          Checking admin access...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
        <section className="relative mx-auto max-w-2xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Admin Console
          </p>
          <h1 className="mt-2 text-3xl font-black">Admin Access Required</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            This console is only visible to allowlisted Supabase admin sessions.
          </p>
          {status && (
            <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
              {status}
            </p>
          )}
          <Link
            className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
            href="/"
          >
            Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08070b] px-3 py-4 text-white sm:px-5 lg:px-6">
      <section className="mx-auto max-w-[94rem] rounded-xl border border-white/10 bg-[#0d0a12] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Admin Console</p>
            <h1 className="mt-1 text-xl font-black text-white">Vault Control Room</h1>
          </div>
          <div className="flex flex-wrap gap-2">
                <Link
                  className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
                  href="/"
                >
                  Dashboard
                </Link>
                <Link
                  className="rounded-md border border-pink-200/20 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-100 transition hover:border-pink-300/50 hover:text-white"
                  href="/admin/analytics"
                >
                  Analytics
                </Link>
                <Link
                  className="rounded-md border border-emerald-200/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:border-emerald-300/50 hover:text-white"
                  href="/admin/app-licenses"
                >
                  Activation Codes
                </Link>
                <Link
                  className="rounded-md border border-sky-200/20 bg-sky-400/10 px-3 py-1.5 text-xs font-bold text-sky-100 transition hover:border-sky-300/50 hover:text-white"
                  href="/admin/wallpapers"
                >
                  Wallpapers
                </Link>
              </div>
        </div>

        <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0a12]/95 px-4 py-2 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {adminTabs.map((tab) => {
                    const isActive = activeTab === tab.key;

                    return (
                      <button
                        className={`shrink-0 rounded-md border px-3 py-1.5 text-left transition ${
                          isActive
                            ? "border-pink-300/35 bg-pink-500/16 text-white"
                            : "border-white/8 bg-white/[0.03] text-zinc-300 hover:border-white/14 hover:text-white"
                        }`}
                        key={tab.key}
                        onClick={() => openAdminTab(tab.key)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[12px] font-black leading-none">{tab.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                              isActive ? "bg-white/10 text-pink-50" : "bg-black/25 text-zinc-400"
                            }`}
                          >
                            {tab.countLabel}
                          </span>
                        </span>
                      </button>
                    );
                  })}
          </div>
        </div>

        <div className="min-w-0 px-4 pb-4 pt-3">

                {activeTab === "console" && (
            <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                Command Console
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Available commands: /give amount @username, /add amount @username (Companion approval required), /drain amount @username, /timeout @username minutes, /timeout remove @username, /title @username [chosen|femsub]
              </p>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 font-mono text-sm text-pink-100">
                  <span className="text-fuchsia-300">&gt;</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-pink-50 outline-none placeholder:text-zinc-600"
                    onChange={(event) => setCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleRunCommand();
                      }
                    }}
                    placeholder="/"
                    value={command}
                  />
                </label>
                <button
                  className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={() => void handleRunCommand()}
                  type="button"
                >
                  {isBusy ? "Running" : "Run"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "caseOpeners" && (
            <div className="mt-4 rounded-[1.5rem] border border-cyan-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
                    Recent Case Openers - Last 24h
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sorted by the latest user to open a case in the last 24 hours. Click a user to expand their recent openings.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadCaseOpeners()}
                  type="button"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 max-h-[36rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                <div className="grid gap-3">
                  {caseOpeners.length > 0 ? (
                    caseOpeners.map((opener) => {
                      const expanded = expandedCaseOpenerId === opener.id;

                      return (
                        <article
                          className="rounded-2xl border border-cyan-200/15 bg-black/35 p-3"
                          key={opener.id}
                        >
                          <button
                            className="flex w-full items-center justify-between gap-3 text-left"
                            onClick={() => setExpandedCaseOpenerId(expanded ? null : opener.id)}
                            type="button"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {opener.username}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Last open {new Date(opener.lastOpenedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full border border-cyan-200/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-50">
                                {opener.totalOpens} opens - {opener.totalCoinsWon.toLocaleString()} coins won
                              </span>
                              <span className="text-cyan-100">{expanded ? "-" : "+"}</span>
                            </div>
                          </button>

                          {expanded && (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-white">
                                    {opener.username}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    Latest case opening history
                                  </p>
                                </div>
                                <p className="text-xs font-bold text-cyan-100">
                                  {opener.totalCoinsWon.toLocaleString()} coins won
                                </p>
                              </div>

                              <div className="mt-3 space-y-2">
                                {opener.recentOpenings.map((opening) => (
                                  <div
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2"
                                    key={opening.id}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-white">
                                        {opening.crateName}
                                      </p>
                                      <p className="truncate text-xs text-zinc-500">
                                        {opening.itemName}
                                      </p>
                                      <p className="mt-1 text-[11px] text-zinc-400">
                                        Chance{" "}
                                        <span className="font-bold text-cyan-100">
                                          {opening.itemChancePercent === null
                                            ? "n/a"
                                            : `${opening.itemChancePercent.toFixed(2)}%`}
                                        </span>{" "}
                                        - Value{" "}
                                        <span className="font-bold text-amber-100">
                                          {opening.itemSellValue === null
                                            ? "n/a"
                                            : `${opening.itemSellValue.toLocaleString()} coins`}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                                        {opening.itemRarity}
                                      </p>
                                      <p className="text-[11px] text-zinc-500">
                                        {new Date(opening.openedAt).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                      No recent case openers yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "irlTasks" && (
            <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                  Assigned IRL Tasks
                </p>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadIrlTasks()}
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {irlTasks.length > 0 ? (
                  irlTasks.map((task) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-black/35 p-3"
                      key={task.id}
                    >
                      {task.status === "assigned" &&
                        task.due_at &&
                        new Date(task.due_at).getTime() <= adminNow && (
                          <p className="mb-3 rounded-2xl border border-rose-200/25 bg-rose-500/10 px-3 py-2 text-sm font-black text-rose-100">
                            ! Deadline expired. No fail is added unless you apply it manually.
                          </p>
                        )}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-white">{task.username}</p>
                          <p className="mt-1 text-sm leading-6 text-pink-50">
                            {task.task_label}
                          </p>
                          {task.task_description && (
                            <p className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-zinc-300">
                              {task.task_description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-zinc-500">
                            Segment #{task.wheel_index + 1} - {task.cost_coins} coins - {new Date(task.assigned_at).toLocaleString()}
                          </p>
                          {task.due_at && (
                            <p className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-100">
                              Due {new Date(task.due_at).toLocaleString()} - manual timeout if needed
                            </p>
                          )}
                          {task.reviewed_at && (
                            <p className="mt-2 text-xs text-zinc-500">
                              Reviewed {new Date(task.reviewed_at).toLocaleString()}
                            </p>
                          )}
                          {task.shamed_at && (
                            <p className="mt-2 text-xs font-semibold text-rose-100/80">
                              Fail recorded {new Date(task.shamed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-100">
                          {task.status}
                        </span>
                      </div>
                      {task.status === "assigned" && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <button
                            className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() => void handleIrlTaskReview(task.id, "approve")}
                            type="button"
                          >
                            Approve +10 Affection
                          </button>
                          <button
                            className="rounded-2xl border border-fuchsia-200/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-black text-fuchsia-100 transition hover:border-fuchsia-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() => void handleIrlTaskReview(task.id, "excuse")}
                            type="button"
                          >
                            Clear via Throne
                          </button>
                          <button
                            className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() => void handleIrlTaskReview(task.id, "cancelShame")}
                            type="button"
                          >
                            Cancel Task + Fail
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                    No assigned IRL tasks yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "timeouts" && (
            <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                  Active Timeouts
                </p>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadTimeouts()}
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {timedOutUsers.length > 0 ? (
                  timedOutUsers.map((user) => (
                    <article
                      className="rounded-2xl border border-yellow-200/20 bg-yellow-400/10 p-3"
                      key={user.id}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-black text-white">{user.username}</p>
                          <p className="mt-1 text-xs text-yellow-100">
                            Remaining {formatRemaining(user.timeout_until, adminNow)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Until {new Date(user.timeout_until).toLocaleString()} - fail {user.shame_count ?? 0}
                          </p>
                          {user.timeout_reason === "evil_debt_underage" && (
                            <p className="mt-2 inline-flex rounded-full border border-red-200/25 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-50">
                              Evil Debt safety timeout
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy}
                            onClick={() => void handleTimeoutAction(user.id, "cancel")}
                            type="button"
                          >
                            Cancel Timeout
                          </button>
                          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-zinc-300">
                            <input
                              className="w-20 bg-transparent font-mono text-pink-50 outline-none placeholder:text-zinc-600"
                              onChange={(event) =>
                                setTimeoutInputs((current) => ({
                                  ...current,
                                  [user.id]: event.target.value,
                                }))
                              }
                              placeholder="1h"
                              value={timeoutInputs[user.id] ?? ""}
                            />
                            <button
                              className="font-black text-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() =>
                                void handleTimeoutAction(
                                  user.id,
                                  "change",
                                  timeoutInputs[user.id] ?? "",
                                )
                              }
                              type="button"
                            >
                              Change Duration
                            </button>
                          </label>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                    No active timeouts.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "debt" && (
            <div className="mt-4 rounded-[1.5rem] border border-red-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(220,38,38,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-red-200/70">
                    Debt Contracts
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Switch between normal and evil debts without leaving this section.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-black transition ${
                      debtSubTab === "normal"
                        ? "bg-red-500/20 text-red-50"
                        : "border border-white/10 bg-white/[0.05] text-zinc-200"
                    }`}
                    disabled={isBusy}
                    onClick={() => setDebtSubTab("normal")}
                    type="button"
                  >
                    Normal Debts
                  </button>
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-black transition ${
                      debtSubTab === "evil"
                        ? "bg-red-500/20 text-red-50"
                        : "border border-white/10 bg-white/[0.05] text-zinc-200"
                    }`}
                    disabled={isBusy}
                    onClick={() => setDebtSubTab("evil")}
                    type="button"
                  >
                    Evil Debts
                  </button>
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-black transition ${
                      debtSubTab === "throne"
                        ? "bg-amber-500/20 text-amber-50"
                        : "border border-white/10 bg-white/[0.05] text-zinc-200"
                    }`}
                    disabled={isBusy}
                    onClick={() => setDebtSubTab("throne")}
                    type="button"
                  >
                    Throne Debts {pendingThroneDebtCount > 0 ? `(${pendingThroneDebtCount})` : ""}
                  </button>
                  <button
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                    disabled={isBusy}
                    onClick={() => void loadDebtContracts()}
                    type="button"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {debtSubTab === "normal" ? (
                  <div className="grid gap-3">
                    {debtContracts.filter((contract) => (contract.contract_type ?? "normal") !== "evil").length > 0 ? (
                      debtContracts
                        .filter((contract) => (contract.contract_type ?? "normal") !== "evil")
                        .map((contract) => (
                          <article
                            className="rounded-2xl border border-red-200/15 bg-red-950/15 p-3"
                            key={contract.id}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-black text-white">
                                  {contract.username} - {contract.pet_name}
                                </p>
                                <p className="mt-1 text-sm text-red-50">
                                  {contract.period_type} / {contract.debt_amount.toLocaleString()} coins
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Duration {contract.duration_periods} periods - paid {contract.paid_periods} - missed {contract.missed_periods}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Due {new Date(contract.next_due_at).toLocaleString()} - ends {new Date(contract.ends_at).toLocaleString()}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  Balance {Number(contract.current_coins ?? 0).toLocaleString()} - limit {Number(contract.capacity_snapshot?.totalLimit ?? 0).toLocaleString()} - reviewed exposure {Number(contract.capacity_snapshot?.requestedExposure ?? contract.debt_amount * Math.min(contract.duration_periods, contract.period_type === "weekly" ? 8 : 3)).toLocaleString()}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  Full total {Number(contract.capacity_snapshot?.requestedTotal ?? contract.debt_amount * contract.duration_periods).toLocaleString()} - purchase pledge: {contract.purchase_pledge ? "Accepted (+100%)" : "Not accepted"} - review: {contract.admin_review_required ? "Required" : "Clear"}
                                </p>
                              </div>
                              <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                                {contract.random_generated && (
                                  <span className="rounded-full border border-yellow-200/30 bg-yellow-400/10 px-3 py-1 text-xs font-black uppercase text-yellow-50">
                                    Random
                                  </span>
                                )}
                                <span className="rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-50">
                                  {contract.status}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              {contract.purchase_pledge && contract.admin_review_required && !contract.debt_timeout_active ? (
                                <button
                                  className="rounded-2xl border border-red-200/25 bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 transition hover:border-red-200/50 disabled:opacity-50"
                                  disabled={isBusy}
                                  onClick={() => void handleDebtAdminAction("applyTimeout", contract.id)}
                                  type="button"
                                >
                                  Apply 7-Day Timeout
                                </button>
                              ) : null}
                              {contract.debt_timeout_active ? (
                                <button
                                  className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:opacity-50"
                                  disabled={isBusy}
                                  onClick={() => void handleDebtAdminAction("clearTimeout", contract.id)}
                                  type="button"
                                >
                                  Clear Debt Timeout
                                </button>
                              ) : null}
                              <button
                                className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isBusy}
                                onClick={() => void handleDebtAdminAction("closeNoRefund", contract.id)}
                                type="button"
                              >
                                Close - No Refund
                              </button>
                            </div>
                          </article>
                        ))
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                        No debt contracts yet.
                      </p>
                    )}
                  </div>
                ) : debtSubTab === "throne" ? (
                  <div className="grid gap-3">
                    {throneDebtContracts.length > 0 ? (
                      throneDebtContracts.map((contract) => {
                        const paidInstallments = (contract.installments ?? []).filter((item) => item.status === "approved_paid");
                        const pendingReviews = (contract.payment_reviews ?? []).filter((review) => review.status === "pending");
                        const overdueInstallments = (contract.installments ?? []).filter((item) =>
                          item.status !== "approved_paid" &&
                          new Date(item.due_date).getTime() <= adminNow,
                        );
                        const paidUsd = paidInstallments.reduce((sum, item) => sum + Number(item.amount_usd ?? 0), 0);

                        return (
                          <article
                            className="rounded-2xl border border-amber-200/15 bg-amber-950/10 p-3"
                            key={contract.id}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-sm font-black text-white">
                                  {contract.username ?? "@unknown"} - ${contract.total_amount_usd.toFixed(2)}
                                </p>
                                <p className="mt-1 text-sm text-amber-50">
                                  {contract.repayment_frequency} / {contract.installment_count} installments / ${contract.installment_amount_usd.toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Paid ${paidUsd.toFixed(2)} - remaining ${Math.max(0, contract.total_amount_usd - paidUsd).toFixed(2)}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  User note: {contract.user_note || "-"}
                                </p>
                                {contract.status === "timeout" ? (
                                  <p className="mt-1 text-xs font-bold text-red-100">
                                    Timeout redemption: ${Number(contract.timeout_overdue_amount_usd ?? 0).toFixed(2)} overdue x {Number(contract.timeout_redemption_multiplier ?? 1.3).toFixed(2)} = ${Number(contract.timeout_redemption_amount_usd ?? 0).toFixed(2)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                                <span className="rounded-full border border-amber-200/20 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase text-amber-50">
                                  {contract.status}
                                </span>
                                {pendingReviews.length > 0 ? (
                                  <span className="rounded-full border border-sky-200/20 bg-sky-400/10 px-3 py-1 text-xs font-black uppercase text-sky-50">
                                    {pendingReviews.length} payment review
                                  </span>
                                ) : null}
                                {overdueInstallments.length > 0 ? (
                                  <span className="rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-50">
                                    {overdueInstallments.length} overdue
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {contract.status === "pending_review" ? (
                                <>
                                  <button
                                    className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({ action: "approve_contract", contractId: contract.id })}
                                    type="button"
                                  >
                                    Approve Contract
                                  </button>
                                  <button
                                    className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({
                                      action: "reject_contract",
                                      adminNote: window.prompt("Reject reason / admin note") ?? "",
                                      contractId: contract.id,
                                    })}
                                    type="button"
                                  >
                                    Reject Contract
                                  </button>
                                </>
                              ) : null}
                              {["active", "overdue"].includes(contract.status) ? (
                                <>
                                  <button
                                    className="rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-xs font-black text-yellow-100 transition hover:border-yellow-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({ action: "pause_contract", contractId: contract.id })}
                                    type="button"
                                  >
                                    Pause
                                  </button>
                                  {overdueInstallments.length > 0 ? (
                                    <button
                                      className="rounded-2xl border border-red-200/25 bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 transition hover:border-red-200/50 disabled:opacity-50"
                                      disabled={isBusy}
                                      onClick={() => void handleThroneDebtAction({
                                        action: "apply_throne_debt_timeout",
                                        adminNote: window.prompt("Timeout admin note") ?? "",
                                        contractId: contract.id,
                                      })}
                                      type="button"
                                    >
                                      Apply Throne Debt Timeout
                                    </button>
                                  ) : null}
                                  <button
                                    className="rounded-2xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:border-red-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({ action: "mark_defaulted", contractId: contract.id })}
                                    type="button"
                                  >
                                    Mark Defaulted
                                  </button>
                                </>
                              ) : contract.status === "timeout" ? (
                                <>
                                  <button
                                    className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({
                                      action: "lift_timeout",
                                      adminNote: window.prompt("Lift timeout note") ?? "",
                                      contractId: contract.id,
                                    })}
                                    type="button"
                                  >
                                    Lift Timeout
                                  </button>
                                  <button
                                    className="rounded-2xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:border-red-200/50 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleThroneDebtAction({ action: "mark_defaulted", contractId: contract.id })}
                                    type="button"
                                  >
                                    Mark Defaulted
                                  </button>
                                </>
                              ) : contract.status === "paused" ? (
                                <button
                                  className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:opacity-50"
                                  disabled={isBusy}
                                  onClick={() => void handleThroneDebtAction({ action: "resume_contract", contractId: contract.id })}
                                  type="button"
                                >
                                  Resume
                                </button>
                              ) : null}
                              {["active", "overdue", "timeout", "paused", "pending_review"].includes(contract.status) ? (
                                <button
                                  className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:opacity-50"
                                  disabled={isBusy}
                                  onClick={() => void handleThroneDebtAction({ action: "cancel_contract", contractId: contract.id })}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>

                            <div className="mt-3 grid gap-2">
                              {(contract.installments ?? []).map((installment) => {
                                const review = pendingReviews.find((item) => item.installment_id === installment.id);
                                const overdue =
                                  installment.status !== "approved_paid" &&
                                  new Date(installment.due_date).getTime() <= adminNow;

                                return (
                                  <div
                                    className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs"
                                    key={installment.id}
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="font-black text-white">
                                          #{installment.installment_number} - ${installment.amount_usd.toFixed(2)} - {installment.status}
                                        </p>
                                        <p className="mt-1 text-zinc-500">
                                          Due {new Date(installment.due_date).toLocaleString()}
                                          {overdue ? " - overdue" : ""}
                                        </p>
                                        {review ? (
                                          <p className="mt-1 text-amber-100">
                                            Review: {review.throne_order_link} {review.user_note ? `- ${review.user_note}` : ""}
                                          </p>
                                        ) : null}
                                      </div>
                                      {review ? (
                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            className="rounded-xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 font-black text-emerald-100 disabled:opacity-50"
                                            disabled={isBusy}
                                            onClick={() => void handleThroneDebtAction({
                                              action: "approve_installment_payment",
                                              installmentId: installment.id,
                                              reviewId: review.id,
                                            })}
                                            type="button"
                                          >
                                            {contract.status === "timeout" ? "Approve Redemption" : "Approve Payment"}
                                          </button>
                                          <button
                                            className="rounded-xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 font-black text-rose-100 disabled:opacity-50"
                                            disabled={isBusy}
                                            onClick={() => void handleThroneDebtAction({
                                              action: "reject_installment_payment",
                                              adminNote: window.prompt("Payment rejection reason") ?? "",
                                              installmentId: installment.id,
                                              reviewId: review.id,
                                            })}
                                            type="button"
                                          >
                                            {contract.status === "timeout" ? "Reject Redemption" : "Reject Payment"}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                              {(contract.installments ?? []).length === 0 ? (
                                <p className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-zinc-400">
                                  Installments are generated after contract approval.
                                </p>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                        No Throne Debt contracts yet.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {debtContracts.filter((contract) => contract.contract_type === "evil").length > 0 ? (
                      debtContracts.filter((contract) => contract.contract_type === "evil").map((contract) => {
                        const expanded = expandedEvilDebtId === contract.id;
                        const installmentNumber = getAdminDebtCurrentInstallmentNumber(contract);
                        const currentInstallmentRemaining = getAdminDebtCurrentInstallmentRemaining(contract);
                        const remainingBalance = getAdminDebtRemainingBalance(contract);
                        const dueAtMs = new Date(contract.next_due_at).getTime();
                        const isOverdue = contract.status === "active" && Number.isFinite(dueAtMs) && dueAtMs <= adminNow;
                        const installmentStateLabel =
                          contract.status !== "active"
                            ? contract.status
                            : currentInstallmentRemaining < contract.debt_amount
                              ? "partial"
                              : isOverdue
                                ? "due"
                                : "upcoming";

                        return (
                          <article
                            className="rounded-2xl border border-red-200/15 bg-black/35 p-3"
                            key={contract.id}
                          >
                            <button
                              className="grid w-full gap-2 text-left text-sm sm:grid-cols-[1.3fr_1fr_1fr_auto]"
                              onClick={() => setExpandedEvilDebtId(expanded ? null : contract.id)}
                              type="button"
                            >
                              <span className="font-black text-white">{contract.username}</span>
                              <span className="text-red-50">{contract.full_name ?? "No name"}</span>
                              <span className="text-zinc-300">
                                {currentInstallmentRemaining.toLocaleString()} / {contract.debt_amount.toLocaleString()}
                              </span>
                              <span className="rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-50">
                                {contract.status}
                              </span>
                            </button>
                            {expanded && (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3">
                                <div className="grid gap-2 sm:grid-cols-4">
                                  <div className="rounded-2xl border border-red-200/12 bg-red-500/8 px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Installment</p>
                                    <p className="mt-1 text-lg font-black text-white">
                                      {installmentNumber}/{contract.duration_periods}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-red-200/12 bg-red-500/8 px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Current Due</p>
                                    <p className="mt-1 text-lg font-black text-red-50">
                                      {currentInstallmentRemaining.toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-red-200/12 bg-red-500/8 px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Remaining Debt</p>
                                    <p className="mt-1 text-lg font-black text-white">
                                      {remainingBalance.toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-red-200/12 bg-red-500/8 px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Payment State</p>
                                    <p className="mt-1 text-lg font-black uppercase text-amber-100">
                                      {installmentStateLabel}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                                  <span>Full name: {contract.full_name ?? "-"}</span>
                                  <span>Age: {contract.declared_age ?? "-"}</span>
                                  <span>Username: {contract.username}</span>
                                  <span>User id: {contract.user_id}</span>
                                  <span>Timezone: {contract.timezone ?? "-"}</span>
                                  <span>Custom note: {contract.custom_note ?? "-"}</span>
                                  <span>Debt amount per installment: {contract.debt_amount.toLocaleString()}</span>
                                  <span>Duration: {contract.duration_periods}</span>
                                  <span>Frequency: {contract.period_type}</span>
                                  <span>Status: {contract.status}</span>
                                  <span>Paid periods: {contract.paid_periods}</span>
                                  <span>Missed periods: {contract.missed_periods}</span>
                                  <span>Current balance: {Number(contract.current_coins ?? 0).toLocaleString()}</span>
                                  <span>Reviewed periods: {Number(contract.capacity_snapshot?.evaluatedPeriods ?? Math.min(contract.duration_periods, contract.period_type === "weekly" ? 8 : 3))}</span>
                                  <span>Affordability limit: {Number(contract.capacity_snapshot?.totalLimit ?? 0).toLocaleString()}</span>
                                  <span>Reviewed exposure: {Number(contract.capacity_snapshot?.requestedExposure ?? contract.debt_amount * Math.min(contract.duration_periods, contract.period_type === "weekly" ? 8 : 3)).toLocaleString()}</span>
                                  <span>Full contract total: {Number(contract.capacity_snapshot?.requestedTotal ?? contract.debt_amount * contract.duration_periods).toLocaleString()}</span>
                                  <span>Reliable period income: {Number(contract.capacity_snapshot?.reliablePeriodIncome ?? 0).toLocaleString()}</span>
                                  <span>Purchase pledge: {contract.purchase_pledge ? "Accepted (+100%)" : "Not accepted"}</span>
                                  <span>Admin review: {contract.admin_review_required ? "Required" : "Clear"}</span>
                                  <span>
                                    Next due: {Number.isFinite(dueAtMs) ? new Date(dueAtMs).toLocaleString() : "-"}
                                  </span>
                                  <span>
                                    Due state: {contract.status !== "active" ? "Not active" : isOverdue ? "Overdue now" : "Not due yet"}
                                  </span>
                                  <span>Consent 1: {contract.consent_primary ? "Confirmed" : "Missing"}</span>
                                  <span>Consent 2: {contract.consent_secondary ? "Confirmed" : "Missing"}</span>
                                  <span>Signed: {new Date(contract.started_at).toLocaleString()}</span>
                                </div>
                                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                                  {(contract.image_urls ?? []).map((imageUrl, index) => (
                                    <button
                                      className="overflow-hidden rounded-xl border border-red-200/15 bg-black"
                                      key={`${contract.id}-${index}`}
                                      onClick={() => setPreviewDebtImage(imageUrl)}
                                      type="button"
                                    >
                                      <img
                                        alt={`Evil debt upload ${index + 1}`}
                                        className="aspect-square w-full object-cover"
                                        src={imageUrl}
                                      />
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                  {contract.status === "pending" && (
                                    <button
                                      className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                      disabled={isBusy}
                                      onClick={() => void handleApproveEvilDebtContract(contract.id)}
                                      type="button"
                                    >
                                      Approve Evil Debt
                                    </button>
                                  )}
                                  {contract.purchase_pledge && contract.admin_review_required && !contract.debt_timeout_active ? (
                                    <button
                                      className="rounded-2xl border border-red-200/25 bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 transition hover:border-red-200/50 disabled:opacity-50"
                                      disabled={isBusy}
                                      onClick={() => void handleDebtAdminAction("applyTimeout", contract.id)}
                                      type="button"
                                    >
                                      Apply 7-Day Timeout
                                    </button>
                                  ) : null}
                                  {contract.debt_timeout_active ? (
                                    <button
                                      className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:opacity-50"
                                      disabled={isBusy}
                                      onClick={() => void handleDebtAdminAction("clearTimeout", contract.id)}
                                      type="button"
                                    >
                                      Clear Debt Timeout
                                    </button>
                                  ) : null}
                                  <button
                                    className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handleDebtAdminAction("closeNoRefund", contract.id)}
                                    type="button"
                                  >
                                    Close - No Refund
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                        No Evil Debt Contracts yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div className="mt-4 rounded-[1.5rem] border border-yellow-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(250,204,21,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-yellow-200/70">
                    Random Events
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Create, activate, or end temporary global bonuses.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadEvents()}
                  type="button"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-yellow-200/15 bg-yellow-400/10 p-3">
                <p className="text-sm font-black text-yellow-50">Create Active Event</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    className="min-w-0 flex-1 rounded-2xl border border-yellow-200/20 bg-black/55 px-3 py-2 text-sm font-bold text-yellow-50 outline-none"
                    onChange={(event) => setEventTemplateKey(event.target.value)}
                    value={eventTemplateKey}
                  >
                    {[FIRST_DAY_EVENT_TEMPLATE, ...EVENT_TEMPLATES].map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-2xl border border-yellow-100/30 bg-yellow-300/15 px-4 py-2 text-sm font-black text-yellow-50 transition hover:border-yellow-100/60 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBusy}
                    onClick={() => void handleEventAction("create")}
                    type="button"
                  >
                    Create + Activate
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {events.length > 0 ? (
                  events.map(renderEventCard)
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                    No events yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "announcements" && (
            <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">
                    Site Announcements
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Create the banner shown on the homepage and retire old messages when needed.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadAnnouncements()}
                  type="button"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-pink-200/15 bg-pink-400/10 p-3">
                <p className="text-sm font-black text-pink-50">Create Active Announcement</p>
                <div className="mt-3 grid gap-2">
                  <input
                    className="rounded-2xl border border-pink-200/20 bg-black/55 px-3 py-2 text-sm font-bold text-pink-50 outline-none placeholder:text-pink-100/35"
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    placeholder="Announcement title"
                    value={announcementTitle}
                  />
                  <textarea
                    className="min-h-28 rounded-2xl border border-pink-200/20 bg-black/55 px-3 py-2 text-sm text-pink-50 outline-none placeholder:text-pink-100/35"
                    onChange={(event) => setAnnouncementBody(event.target.value)}
                    placeholder="Announcement body"
                    value={announcementBody}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="w-full rounded-2xl border border-pink-200/20 bg-black/55 px-3 py-2 text-sm font-bold text-pink-50 outline-none placeholder:text-pink-100/35 sm:max-w-36"
                      min={1}
                      onChange={(event) => setAnnouncementDays(event.target.value)}
                      placeholder="Days"
                      type="number"
                      value={announcementDays}
                    />
                    <button
                      className="rounded-2xl border border-pink-100/30 bg-pink-300/15 px-4 py-2 text-sm font-black text-pink-50 transition hover:border-pink-100/60 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => void handleAnnouncementAction("create")}
                      type="button"
                    >
                      Publish Announcement
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {announcements.length > 0 ? (
                  announcements.map((announcement) => {
                    const isExpired = new Date(announcement.ends_at).getTime() <= Date.now();

                    return (
                      <article className="rounded-2xl border border-white/10 bg-black/35 p-3" key={announcement.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-white">{announcement.title}</p>
                            <p className="mt-1 text-sm leading-6 text-zinc-300">{announcement.body}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {new Date(announcement.starts_at).toLocaleString()} - {new Date(announcement.ends_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                                announcement.active && !isExpired
                                  ? "border-emerald-200/20 bg-emerald-400/10 text-emerald-50"
                                  : "border-zinc-200/15 bg-zinc-500/10 text-zinc-100"
                              }`}
                            >
                              {announcement.active && !isExpired ? "Active" : "Inactive"}
                            </span>
                            <button
                              className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() => void handleAnnouncementAction("end", announcement.id)}
                              type="button"
                            >
                              End
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                    No announcements yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "petTasks" && (
            <div className="mt-4 rounded-[1.5rem] border border-red-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(220,38,38,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-red-200/70">
                    Pet Task Review
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Approvals add the configured Pet Score reward.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadPetTasks()}
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                <div className="grid gap-3">
                  {petTasks.length > 0 ? (
                    petTasks.map((task) => {
                      const metadata = (task.metadata ?? {}) as Record<string, unknown>;
                      const throneAmount =
                        typeof metadata.throneAmount === "number" ? metadata.throneAmount : null;
                      const throneBaseCoinAmount =
                        typeof metadata.throneBaseCoinAmount === "number" ? metadata.throneBaseCoinAmount : null;
                      const throneGiveBonusAmount =
                        typeof metadata.throneGiveBonusAmount === "number" ? metadata.throneGiveBonusAmount : null;
                      const throneTaskBonusAmount =
                        typeof metadata.throneTaskBonusAmount === "number" ? metadata.throneTaskBonusAmount : null;
                      const throneReceiveAmount =
                        typeof metadata.throneTotalCoinAmount === "number"
                          ? metadata.throneTotalCoinAmount
                          : typeof metadata.throneReceiveAmount === "number"
                            ? metadata.throneReceiveAmount
                            : null;
                      const proofImage =
                        typeof metadata.proofImage === "string" ? metadata.proofImage : null;

                      return (
                        <article
                          className="rounded-2xl border border-red-200/15 bg-red-950/15 p-3"
                          key={task.id}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-white">{task.username}</p>
                              <p className="mt-1 text-sm leading-6 text-red-50">
                                {task.task_id}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Submitted {new Date(task.created_at).toLocaleString()} - current pet score {task.pet_score}
                              </p>
                              {task.reviewed_at && (
                                <p className="mt-1 text-xs text-zinc-500">
                                  Reviewed {new Date(task.reviewed_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-50">
                                {task.status}
                              </span>
                              <span className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-xs font-black text-pink-50">
                                +{task.reward_score} score
                              </span>
                            </div>
                          </div>
                          {task.task_id === "pet-throne-tribute" && (
                            <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                              <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-300">
                                <span className="rounded-full border border-pink-200/15 bg-pink-500/10 px-3 py-1">
                                  Selected: {throneAmount ?? "-"}
                                </span>
                                <span className="rounded-full border border-zinc-200/15 bg-zinc-500/10 px-3 py-1">
                                  Base: {typeof throneBaseCoinAmount === "number" ? throneBaseCoinAmount.toLocaleString() : "-"}
                                </span>
                                <span className="rounded-full border border-amber-200/15 bg-amber-500/10 px-3 py-1">
                                  Give bonus: {typeof throneGiveBonusAmount === "number" ? throneGiveBonusAmount.toLocaleString() : "-"}
                                </span>
                                <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-3 py-1">
                                  Task bonus: {typeof throneTaskBonusAmount === "number" ? throneTaskBonusAmount.toLocaleString() : "-"}
                                </span>
                                <span className="rounded-full border border-sky-200/15 bg-sky-500/10 px-3 py-1">
                                  Total: {typeof throneReceiveAmount === "number" ? throneReceiveAmount.toLocaleString() : "-"}
                                </span>
                              </div>
                              {proofImage && (
                                <button
                                  className="overflow-hidden rounded-2xl border border-red-200/15 bg-black"
                                  onClick={() => setPreviewDebtImage(proofImage)}
                                  type="button"
                                >
                                  <img
                                    alt="Pet Throne proof"
                                    className="max-h-64 w-full object-contain"
                                    src={proofImage}
                                  />
                                </button>
                              )}
                            </div>
                          )}
                          {task.status === "pending" && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <button
                                className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isBusy}
                                onClick={() => void handlePetTaskReview(task.id, "approve")}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isBusy}
                                onClick={() => void handlePetTaskReview(task.id, "reject")}
                                type="button"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                      No Pet tasks submitted yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-pink-200/70">
                      Recent Throne Approval Logs
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      These logs disappear after 24 hours unless you mark them correct earlier.
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                    disabled={isBusy}
                    onClick={() => void loadPetTaskLogs()}
                    type="button"
                  >
                    Refresh Logs
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {petTaskLogs.length > 0 ? (
                    petTaskLogs.map((log) => {
                      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
                      const logStatusTone =
                        log.status === "executed"
                          ? "border-emerald-200/20 bg-emerald-400/10 text-emerald-50"
                          : log.status === "queued"
                            ? "border-yellow-200/20 bg-yellow-400/10 text-yellow-50"
                            : log.status === "reverted"
                              ? "border-rose-200/20 bg-rose-500/10 text-rose-100"
                              : "border-sky-200/20 bg-sky-500/10 text-sky-100";

                      return (
                        <article className="rounded-2xl border border-white/10 bg-black/35 p-3" key={log.id}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-white">{log.username_snapshot ?? "@unknown"}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Created {new Date(log.created_at).toLocaleString()}
                                {log.resolved_at ? ` - resolved ${new Date(log.resolved_at).toLocaleString()}` : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-zinc-300">
                                <span className="rounded-full border border-zinc-200/15 bg-zinc-500/10 px-3 py-1">
                                  Base: {Number(log.throne_base_coin_amount ?? 0).toLocaleString()}
                                </span>
                                <span className="rounded-full border border-amber-200/15 bg-amber-500/10 px-3 py-1">
                                  Give bonus: {Number(log.throne_give_bonus_amount ?? 0).toLocaleString()}
                                </span>
                                <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-3 py-1">
                                  Task bonus: {Number(log.throne_task_bonus_amount ?? 0).toLocaleString()}
                                </span>
                                <span className="rounded-full border border-sky-200/15 bg-sky-500/10 px-3 py-1">
                                  Total: {Number(log.coin_total_delta ?? 0).toLocaleString()}
                                </span>
                                <span className="rounded-full border border-pink-200/15 bg-pink-500/10 px-3 py-1">
                                  Pet score: +{Number(log.reward_score_delta ?? 0)}
                                </span>
                              </div>
                              {log.pending_action_id && (
                                <p className="mt-2 text-xs text-yellow-100/80">
                                  Waiting on Companion App execution.
                                </p>
                              )}
                              {metadata.proofImagePresent === true && (
                                <p className="mt-1 text-xs text-zinc-500">Proof image was attached.</p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${logStatusTone}`}>
                                {log.status}
                              </span>
                              {(log.status === "queued" || log.status === "executed") && (
                                <>
                                  <button
                                    className="rounded-2xl border border-sky-200/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-100 transition hover:border-sky-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handlePetTaskLogAction(log.id, "clear")}
                                    type="button"
                                  >
                                    Mark Correct
                                  </button>
                                  <button
                                    className="rounded-2xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:border-rose-200/50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => void handlePetTaskLogAction(log.id, "revert")}
                                    type="button"
                                  >
                                    Revert
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                      No active Throne approval logs.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "maxAffection" && (
            <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                    100 Affection Users
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Profiles that reached Principessa&apos;s maximum mood.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-zinc-200"
                  disabled={isBusy}
                  onClick={() => void loadMaxAffectionUsers()}
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                <div className="grid gap-3">
                  {maxAffectionUsers.length > 0 ? (
                    maxAffectionUsers.map((user) => (
                      <article
                        className="rounded-2xl border border-fuchsia-200/15 bg-black/35 p-3"
                        key={user.id}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-white">{user.username}</p>
                            <p className="mt-1 text-xs text-zinc-400">
                              Tribute Total {Number(user.tribute_total ?? 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-pink-200/25 bg-pink-500/15 px-3 py-1 text-xs font-black text-pink-100">
                              {user.affection} affection
                            </span>
                            {user.updated_at && (
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                                {new Date(user.updated_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-zinc-400">
                      No users at 100 affection yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

          {status && (
            <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
              {status}
            </p>
          )}
      </section>
      {previewDebtImage && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewDebtImage(null)}
          type="button"
        >
          <img
            alt="Expanded admin proof upload"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl border border-red-200/25 object-contain shadow-[0_0_40px_rgba(248,113,113,0.28)]"
            src={previewDebtImage}
          />
        </button>
      )}
      <FloatingDefneBubble message={defneMessage} />
    </main>
  );
}
