"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserNotificationRecord } from "@/lib/user-notifications";

type AdminNotificationItem = {
  count: number;
  description: string;
  id: string;
  title: string;
  tone: "amber" | "pink" | "red" | "sky";
};

type AdminNotificationCounts = {
  debtDue: number;
  evilDebtPending: number;
  irlPending: number;
  petPending: number;
};

type NotificationBellProps = {
  isAdmin: boolean;
  isLoggedIn: boolean;
};

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function getAdminToneClasses(tone: AdminNotificationItem["tone"]) {
  switch (tone) {
    case "amber":
      return "border-amber-200/15 bg-amber-400/10 text-amber-50";
    case "pink":
      return "border-pink-200/15 bg-pink-500/10 text-pink-50";
    case "red":
      return "border-red-200/15 bg-red-500/10 text-red-50";
    case "sky":
      return "border-sky-200/15 bg-sky-500/10 text-sky-50";
  }
}

export function NotificationBell({ isAdmin, isLoggedIn }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotificationRecord[]>([]);
  const [userUnreadCount, setUserUnreadCount] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);
  const [adminCounts, setAdminCounts] = useState<AdminNotificationCounts>({
    debtDue: 0,
    evilDebtPending: 0,
    irlPending: 0,
    petPending: 0,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!isLoggedIn) {
      setUserNotifications([]);
      setUserUnreadCount(0);
      setAdminNotifications([]);
      setAdminCounts({
        debtDue: 0,
        evilDebtPending: 0,
        irlPending: 0,
        petPending: 0,
      });
      return;
    }

    setIsLoading(true);

    try {
      const requests: Array<Promise<Response>> = [fetch("/api/user/notifications", { cache: "no-store" })];

      if (isAdmin) {
        requests.push(
          fetch("/api/admin/notifications", {
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
        );
      }

      const [userResponse, adminResponse] = await Promise.all(requests);
      const userPayload = (await userResponse.json()) as {
        error?: string;
        notifications?: UserNotificationRecord[];
        unreadCount?: number;
      };

      if (!userResponse.ok) {
        throw new Error(userPayload.error ?? "User notifications failed.");
      }

      setUserNotifications(userPayload.notifications ?? []);
      setUserUnreadCount(userPayload.unreadCount ?? 0);

      if (isAdmin && adminResponse) {
        const adminPayload = (await adminResponse.json()) as {
          counts?: Partial<AdminNotificationCounts>;
          error?: string;
          notifications?: AdminNotificationItem[];
        };

        if (!adminResponse.ok) {
          throw new Error(adminPayload.error ?? "Admin notifications failed.");
        }

        setAdminNotifications(adminPayload.notifications ?? []);
        setAdminCounts({
          debtDue: adminPayload.counts?.debtDue ?? 0,
          evilDebtPending: adminPayload.counts?.evilDebtPending ?? 0,
          irlPending: adminPayload.counts?.irlPending ?? 0,
          petPending: adminPayload.counts?.petPending ?? 0,
        });
      } else {
        setAdminNotifications([]);
        setAdminCounts({
          debtDue: 0,
          evilDebtPending: 0,
          irlPending: 0,
          petPending: 0,
        });
      }
    } catch (error) {
      console.error("Notification center refresh failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const refreshNotifications = () => {
      if (document.visibilityState !== "hidden") {
        void loadNotifications();
      }
    };

    const initialTimer = window.setTimeout(() => {
      refreshNotifications();
    }, 0);
    const interval = window.setInterval(() => {
      refreshNotifications();
    }, 180000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [isLoggedIn, loadNotifications]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const totalAdminCount =
    adminCounts.irlPending +
    adminCounts.petPending +
    adminCounts.evilDebtPending;
  const totalCount = totalAdminCount + userUnreadCount;

  const handleUserAction = useCallback(
    async (action: "delete" | "markRead" | "markReadAll", notificationId?: string) => {
      try {
        const response = await fetch("/api/user/notifications", {
          body: JSON.stringify({
            action,
            notificationId,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          notifications?: UserNotificationRecord[];
          unreadCount?: number;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Notification update failed.");
        }

        setUserNotifications(payload.notifications ?? []);
        setUserUnreadCount(payload.unreadCount ?? 0);
      } catch (error) {
        console.error("Notification action failed", error);
      }
    },
    [],
  );

  const unreadUserNotifications = useMemo(
    () => userNotifications.filter((item) => !item.read_at).length,
    [userNotifications],
  );

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
        onClick={() => {
          setIsOpen((current) => !current);
          if (!isOpen) {
            void loadNotifications();
          }
        }}
        type="button"
      >
        <span className="flex items-center gap-2">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 3a5 5 0 0 0-5 5v2.2c0 .7-.2 1.4-.6 2L5 14.5V16h14v-1.5l-1.4-2.3c-.4-.6-.6-1.3-.6-2V8a5 5 0 0 0-5-5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </svg>
          <span>Notifications</span>
          {totalCount > 0 ? (
            <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs font-black text-white">
              {totalCount}
            </span>
          ) : null}
        </span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(80vh,42rem)] overflow-y-auto rounded-[1.5rem] border border-fuchsia-200/15 bg-[linear-gradient(180deg,rgba(14,6,20,0.98),rgba(7,3,10,0.98))] p-4 pr-3 shadow-[0_24px_80px_rgba(0,0,0,0.48)] [scrollbar-width:thin]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-pink-100/70">
                Notification Center
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {isLoading ? "Refreshing..." : "Live admin alerts and your personal updates."}
              </p>
            </div>
            {unreadUserNotifications > 0 ? (
              <button
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-pink-300/30 hover:text-white"
                onClick={() => void handleUserAction("markReadAll")}
                type="button"
              >
                Mark All Read
              </button>
            ) : null}
          </div>

          {isAdmin ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/75">
                  Admin Alerts
                </p>
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {totalAdminCount} open
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {adminNotifications.length > 0 ? (
                  adminNotifications.map((notification) => (
                    <article
                      className={`rounded-[1.1rem] border px-3 py-3 ${getAdminToneClasses(notification.tone)}`}
                      key={notification.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{notification.title}</p>
                          <p className="mt-1 text-xs leading-5 text-white/80">{notification.description}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]">
                          {notification.count}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-400">
                    No admin alerts right now.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100/75">
                Your Updates
              </p>
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {userUnreadCount} unread
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {userNotifications.length > 0 ? (
                userNotifications.map((notification) => (
                  <article
                    className={`rounded-[1.1rem] border px-3 py-3 ${
                      notification.read_at
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-pink-200/20 bg-pink-500/10"
                    }`}
                    key={notification.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white">{notification.title}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-300">{notification.body}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </div>
                      {!notification.read_at ? (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.7)]" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!notification.read_at ? (
                        <button
                          className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100 transition hover:border-pink-300/35 hover:text-white"
                          onClick={() => void handleUserAction("markRead", notification.id)}
                          type="button"
                        >
                          Mark As Read
                        </button>
                      ) : null}
                      <button
                        className="rounded-full border border-rose-200/15 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100 transition hover:border-rose-200/35 hover:text-white"
                        onClick={() => void handleUserAction("delete", notification.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-400">
                  No personal notifications yet.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
