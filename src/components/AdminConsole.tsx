import { useState } from "react";

type AdminConsoleProps = {
  currentUsername: string;
  onAddCoins: (handle: string, amount: number) => boolean;
};

export function AdminConsole({
  currentUsername,
  onAddCoins,
}: AdminConsoleProps) {
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [command, setCommand] = useState(`/give 500 ${currentUsername}`);
  const [status, setStatus] = useState("");

  const handleAdminLogin = () => {
    // Prototype only: replace this with secure backend auth before production.
    // These local credentials are not real security and must not protect data.
    if (adminUsername === "launcess" && adminPassword === "d3nizli.20") {
      setIsAdminLoggedIn(true);
      setStatus("Admin prototype unlocked.");
      return;
    }

    setStatus("Incorrect admin credentials.");
  };

  const handleRunCommand = () => {
    const match = command.trim().match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);

    if (!match) {
      setStatus("Invalid command. Use: /give 500 @username");
      return;
    }

    const amount = Number(match[1]);
    const handle = match[2];

    if (!Number.isInteger(amount) || amount <= 0 || !handle.startsWith("@")) {
      setStatus("Invalid command. Use: /give 500 @username");
      return;
    }

    const added = onAddCoins(handle, amount);
    setStatus(
      added
        ? `Added ${amount} coins to ${handle}.`
        : "User not found in local prototype.",
    );
  };

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
          Local Admin Console
        </p>
        <h2 className="text-3xl font-black">Prototype Coin Grants</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Local-only tool. No backend, database, payment webhook, or real auth.
        </p>
      </div>

      {!isAdminLoggedIn ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Username
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
              onChange={(event) => setAdminUsername(event.target.value)}
              value={adminUsername}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
              Password
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300/60"
              onChange={(event) => setAdminPassword(event.target.value)}
              type="password"
              value={adminPassword}
            />
          </label>
          <button
            className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)] md:col-span-2"
            onClick={handleAdminLogin}
            type="button"
          >
            Admin Login
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 shadow-[inset_0_0_24px_rgba(236,72,153,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">
            Command Console
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Available command: /give amount @username
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 font-mono text-sm text-pink-100">
              <span className="text-fuchsia-300">&gt;</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-pink-50 outline-none placeholder:text-zinc-600"
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleRunCommand();
                  }
                }}
                placeholder="/give 500 @username"
                value={command}
              />
            </label>
            <button
              className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)]"
              onClick={handleRunCommand}
              type="button"
            >
              Run
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
          {status}
        </p>
      )}
    </section>
  );
}
