"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FloatingDefneBubble } from "@/components/FloatingDefneBubble";

type AdminIrlTask = {
  id: string;
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

export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [command, setCommand] = useState("/give 500 @");
  const [activeTab, setActiveTab] = useState<"console" | "irlTasks">("console");
  const [irlTasks, setIrlTasks] = useState<AdminIrlTask[]>([]);
  const [status, setStatus] = useState("");
  const [defneMessage, setDefneMessage] = useState(
    "Admin ledger ready. Be precise.",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [adminNow, setAdminNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setAdminNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) {
      setStatus("Enter ADMIN_PASSWORD to unlock the console.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/verify", {
        body: JSON.stringify({ adminPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setIsAdminLoggedIn(false);
        setStatus(result.error ?? "Invalid admin password.");
        return;
      }

      setIsAdminLoggedIn(true);
      setStatus("Admin console unlocked for this browser session.");
      void loadIrlTasks();
    } catch {
      setIsAdminLoggedIn(false);
      setStatus("Admin verification failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const loadIrlTasks = async ({ keepStatus = false } = {}) => {
    if (!adminPassword) {
      return;
    }

    setIsBusy(true);
    if (!keepStatus) {
      setStatus("");
    }

    try {
      const response = await fetch("/api/admin/irl-tasks", {
        body: JSON.stringify({ adminPassword }),
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "IRL task list failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunCommand = async () => {
    if (!isAdminLoggedIn) {
      setStatus("Unlock admin before running commands.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/give", {
        body: JSON.stringify({ adminPassword, command }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Admin command failed.");
      }

      setStatus(result.message ?? "Command completed.");
      setDefneMessage(
        command.trim().startsWith("/timeout")
          ? "Timeout applied. Discipline looks good in the ledger."
          : "Coins added. Try not to waste my generosity.",
      );
      if (command.trim().startsWith("/timeout")) {
        void loadIrlTasks();
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
    action: "approve" | "excuse",
  ) => {
    if (!isAdminLoggedIn) {
      setStatus("Unlock admin before reviewing tasks.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/irl-tasks", {
        body: JSON.stringify({ action, adminPassword, taskId }),
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
          : "Cleared through Throne. No affection and no timeout.",
      );
      await loadIrlTasks({ keepStatus: true });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "IRL task review failed.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0),#06030a_78%)]" />
      <section className="relative mx-auto max-w-3xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
              Admin Console
            </p>
            <h1 className="text-3xl font-black">Vault Coin Grants</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Prototype-only tool backed by Supabase. Use a secure admin auth
              system before production.
            </p>
          </div>
          <Link
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-pink-300/40 hover:text-white"
            href="/"
          >
            Dashboard
          </Link>
        </div>

        {!isAdminLoggedIn ? (
          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                ADMIN_PASSWORD
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
                onChange={(event) => setAdminPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleAdminLogin();
                  }
                }}
                type="password"
                value={adminPassword}
              />
            </label>
            <button
              className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)]"
              disabled={isBusy}
              onClick={() => void handleAdminLogin()}
              type="button"
            >
              {isBusy ? "Checking" : "Unlock Admin"}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              {([
                ["console", "Command Console"],
                ["irlTasks", "IRL Tasks"],
              ] as const).map(([key, label]) => (
                <button
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    activeTab === key
                      ? "bg-pink-500/20 text-pink-50"
                      : "border border-white/10 bg-black/35 text-zinc-300"
                  }`}
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                    if (key === "irlTasks") {
                      void loadIrlTasks();
                    }
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "console" && (
              <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
                  Command Console
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Available commands: /give amount @username, /timeout @username minutes
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
                      placeholder="/give 500 @ or /timeout @user 30"
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

            {activeTab === "irlTasks" && (
              <div className="mt-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
                <div className="flex items-center justify-between gap-3">
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
                              ! Deadline expired. Shame +1 is shown on the public board.
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
                              Segment #{task.wheel_index + 1} · {task.cost_coins} coins · {new Date(task.assigned_at).toLocaleString()}
                            </p>
                            {task.due_at && (
                              <p className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-100">
                                Due {new Date(task.due_at).toLocaleString()} · manual timeout if needed
                              </p>
                            )}
                            {task.reviewed_at && (
                              <p className="mt-2 text-xs text-zinc-500">
                                Reviewed {new Date(task.reviewed_at).toLocaleString()}
                              </p>
                            )}
                            {task.shamed_at && (
                              <p className="mt-2 text-xs font-semibold text-rose-100/80">
                                Public shame added {new Date(task.shamed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-100">
                            {task.status}
                          </span>
                        </div>
                        {task.status === "assigned" && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                          </div>
                        )}
                        {task.status === "assigned" &&
                          task.timeout_until &&
                          new Date(task.timeout_until).getTime() > adminNow && (
                          <p className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-100">
                            Timeout until {new Date(task.timeout_until).toLocaleString()}
                          </p>
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
          </div>
        )}

        {status && (
          <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
            {status}
          </p>
        )}
      </section>
      <FloatingDefneBubble message={defneMessage} />
    </main>
  );
}
