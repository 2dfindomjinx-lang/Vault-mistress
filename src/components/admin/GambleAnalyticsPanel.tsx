import {
  GAMBLE_LABELS,
  gambleHouseNet,
  gambleObservedRtp,
  type GambleAnalytics,
  type GambleMetrics,
} from "@/lib/gamble-analytics";

const number = (value: number) => value.toLocaleString();
const rtp = (value: GambleMetrics) => {
  const percent = gambleObservedRtp(value);
  return percent === null ? "—" : `${percent.toFixed(1)}%`;
};

export function GambleAnalyticsPanel({
  data,
  error,
}: {
  data?: GambleAnalytics | null;
  error?: string | null;
}) {
  return (
    <section
      aria-label="Gamble analytics"
      className="rounded-[1.5rem] border border-amber-200/20 bg-black/50 p-4 sm:p-5"
    >
      <h2 className="text-xl font-black text-amber-100">
        Gamble Hall · Last 7 days
      </h2>
      <p className="mt-2 text-xs leading-5 text-zinc-400">
        Rounds started in the last seven GMT+3 days. Admin play is excluded.
        Returns include Double or Nothing; open stakes are excluded from house
        net and RTP.
      </p>
      {error ? (
        <p role="status" className="mt-4 text-sm text-rose-200">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Paid rounds", number(data.summary.rounds)],
              ["Players", number(data.summary.players)],
              ["Coins wagered", number(data.summary.wagered)],
              ["Coins returned", number(data.summary.payout)],
              ["House net", number(gambleHouseNet(data.summary))],
              ["Observed RTP", rtp(data.summary)],
              ["Open rounds", number(data.summary.openRounds)],
              [
                "Double wins / losses",
                `${number(data.summary.doubleWins)} / ${number(data.summary.doubleLosses)}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 p-3"
              >
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="mt-1 break-words text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <caption className="sr-only">Gamble performance by game</caption>
              <thead className="text-xs text-zinc-400">
                <tr>
                  {[
                    "Game",
                    "Rounds",
                    "Players",
                    "Wagered",
                    "Returned",
                    "House net",
                    "Win rate",
                    "RTP",
                  ].map((label) => (
                    <th className="px-3 py-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.games.map((game) => (
                  <tr key={game.game} className="border-t border-white/10">
                    <th className="px-3 py-3 font-semibold">
                      {GAMBLE_LABELS[game.game] ?? game.game}
                    </th>
                    <td className="px-3 py-3">{number(game.rounds)}</td>
                    <td className="px-3 py-3">{number(game.players)}</td>
                    <td className="px-3 py-3">{number(game.wagered)}</td>
                    <td className="px-3 py-3">{number(game.payout)}</td>
                    <td
                      className={`px-3 py-3 ${gambleHouseNet(game) >= 0 ? "text-emerald-200" : "text-rose-200"}`}
                    >
                      {number(gambleHouseNet(game))}
                    </td>
                    <td className="px-3 py-3">
                      {game.settledRounds
                        ? `${((100 * game.profitableRounds) / game.settledRounds).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-3">{rtp(game)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.summary.rounds === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">
              No paid rounds in this period.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Win rate counts completed rounds returning more than the original
            bet.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.byDay.map((day) => (
              <div
                key={day.day}
                className="rounded-xl border border-white/10 p-3 text-xs"
              >
                <p className="font-bold text-amber-100">{day.day}</p>
                <p className="mt-1 text-zinc-400">
                  {number(day.rounds)} rounds · {number(day.wagered)} wagered
                </p>
                <p className="mt-1">House net {number(gambleHouseNet(day))}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-zinc-400">
          Gamble analytics are unavailable.
        </p>
      )}
    </section>
  );
}
