import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ALL_COINS, fetchCoins, type PriceData } from "@/lib/crypto";
import { runHMM, type RegimeResult } from "@/lib/algorithms/hmm";
import {
  runADFTest,
  type PairResult,
} from "@/lib/algorithms/adf";

// ---------- helpers ----------

function RegimeIcon({ regime }: { regime: string }) {
  if (regime === "Bull") return <TrendingUp className="size-4" />;
  if (regime === "Bear") return <TrendingDown className="size-4" />;
  return <Minus className="size-4" />;
}

function regimeColor(regime: string): string {
  if (regime === "Bull") return "text-[oklch(0.72_0.19_160)]";
  if (regime === "Bear") return "text-[oklch(0.65_0.2_25)]";
  return "text-[oklch(0.8_0.15_90)]";
}

function regimeBg(regime: string): string {
  if (regime === "Bull")
    return "bg-[oklch(0.72_0.19_160_/_0.1)] border-[oklch(0.72_0.19_160_/_0.25)]";
  if (regime === "Bear")
    return "bg-[oklch(0.65_0.2_25_/_0.1)] border-[oklch(0.65_0.2_25_/_0.25)]";
  return "bg-[oklch(0.8_0.15_90_/_0.1)] border-[oklch(0.8_0.15_90_/_0.25)]";
}

function strengthColor(s: string): string {
  if (s === "Strong") return "text-[oklch(0.72_0.19_160)]";
  if (s === "Moderate") return "text-[oklch(0.8_0.15_90)]";
  if (s === "Weak") return "text-[oklch(0.72_0.19_180)]";
  return "text-muted-foreground";
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function formatStat(v: number): string {
  return v.toFixed(4);
}

// ---------- Dashboard ----------

export default function Dashboard() {
  const [selected, setSelected] = useState<string[]>(
    ALL_COINS.map((c) => c.id),
  );
  const [coinData, setCoinData] = useState<PriceData[]>([]);
  const [regimes, setRegimes] = useState<Record<string, RegimeResult>>({});
  const [pairs, setPairs] = useState<PairResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const toggleCoin = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const runAnalysis = useCallback(async () => {
    if (selected.length === 0) {
      setCoinData([]);
      setRegimes({});
      setPairs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchCoins(selected, 90);
      if (data.length === 0) throw new Error("No data received from CoinGecko");
      setCoinData(data);

      const regimeResults: Record<string, RegimeResult> = {};
      for (const coin of data) {
        try {
          regimeResults[coin.coin.id] = runHMM(coin.prices);
        } catch (err) {
          console.error(`HMM failed for ${coin.coin.name}:`, err);
        }
      }
      setRegimes(regimeResults);

      const pairResults: PairResult[] = [];
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          try {
            const result = runADFTest(data[i].prices, data[j].prices);
            pairResults.push({
              asset1: data[i].coin.symbol,
              asset2: data[j].coin.symbol,
              result,
            });
          } catch (err) {
            console.error(
              `ADF failed for ${data[i].coin.symbol}/${data[j].coin.symbol}:`,
              err,
            );
          }
        }
      }
      setPairs(pairResults);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch crypto data",
      );
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  if (loading && coinData.length === 0) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <RefreshCw className="size-5 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground font-mono">
              Fetching… running HMM + ADF analysis
            </span>
          </div>
        </motion.div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <Card className="max-w-md w-full border-border/40">
          <CardContent className="p-8 text-center">
            <p className="text-destructive font-semibold mb-2 font-mono">
              Error
            </p>
            <p className="text-sm text-muted-foreground mb-4 font-mono">
              {error}
            </p>
            <button
              onClick={runAnalysis}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const cointegratedPairs = pairs.filter((p) => p.result.isCointegrated);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] rounded-full bg-[oklch(0.72_0.19_180_/_0.04)] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-[oklch(0.72_0.19_160_/_0.03)] blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Results
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Activity className="size-6 text-primary" />
              AT
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground font-mono">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3.5 py-1.5 text-xs font-mono text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </motion.header>

        {/* Coin Selector */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-1">
            Assets
          </span>
          {ALL_COINS.map((coin) => {
            const active = selected.includes(coin.id);
            return (
              <button
                key={coin.id}
                onClick={() => toggleCoin(coin.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-semibold transition-all ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:border-border/70"
                }`}
              >
                {coin.symbol}
              </button>
            );
          })}
          {selected.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/50 ml-1">
              {selected.length} active
            </span>
          )}
        </div>

        {/* Empty state */}
        {selected.length === 0 && (
          <div className="text-center py-20 text-sm text-muted-foreground font-mono">
            Select at least one asset above to run analysis.
          </div>
        )}

        {/* Regime Detection */}
        {coinData.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-base font-bold tracking-tight font-mono">
                HMM Regime Detection
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-0.5">
                3-state HMM · Baum-Welch + Viterbi
              </span>
            </div>

            <div
              className={`grid gap-4 ${
                coinData.length <= 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : coinData.length <= 4
                    ? "grid-cols-2 lg:grid-cols-4"
                    : "grid-cols-2 lg:grid-cols-5"
              }`}
            >
              {coinData.map((coin, idx) => {
                const r = regimes[coin.coin.id];
                if (!r) return null;
                return (
                  <motion.div
                    key={coin.coin.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <Card
                      className={`border ${regimeBg(r.currentRegime)} transition-all`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                              {coin.coin.name}
                            </div>
                            <div className="text-lg font-bold font-mono">
                              {coin.coin.symbol}
                            </div>
                          </div>
                          <div
                            className={`flex items-center justify-center size-9 rounded-full ${regimeBg(r.currentRegime)}`}
                          >
                            <RegimeIcon regime={r.currentRegime} />
                          </div>
                        </div>

                        <div
                          className={`text-2xl font-black font-mono mb-1 ${regimeColor(r.currentRegime)}`}
                        >
                          {r.currentRegime}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mb-4">
                          conf:{" "}
                          <span className="text-foreground">
                            {pct(r.currentConfidence)}
                          </span>
                        </div>

                        {/* Mini timeline */}
                        <div className="flex gap-px mb-4">
                          {r.regimes.slice(-30).map((reg, i) => (
                            <div
                              key={i}
                              className={`flex-1 h-2 rounded-sm ${
                                reg === "Bull"
                                  ? "bg-[oklch(0.72_0.19_160)]"
                                  : reg === "Bear"
                                    ? "bg-[oklch(0.65_0.2_25)]"
                                    : "bg-[oklch(0.8_0.15_90)]"
                              } opacity-80`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground font-mono mb-3">
                          <span>-30d</span>
                          <span>now</span>
                        </div>

                        {/* Distribution */}
                        <div className="space-y-1.5">
                          {(
                            [
                              ["Bull", r.regimeDistribution.bull],
                              ["Neutral", r.regimeDistribution.neutral],
                              ["Bear", r.regimeDistribution.bear],
                            ] as const
                          ).map(([label, value]) => (
                            <div key={label}>
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span
                                  className={
                                    label === "Bull"
                                      ? "text-[oklch(0.72_0.19_160)]"
                                      : label === "Bear"
                                        ? "text-[oklch(0.65_0.2_25)]"
                                        : "text-[oklch(0.8_0.15_90)]"
                                  }
                                >
                                  {label}
                                </span>
                                <span className="text-foreground">
                                  {pct(value)}
                                </span>
                              </div>
                              <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    label === "Bull"
                                      ? "bg-[oklch(0.72_0.19_160)]"
                                      : label === "Bear"
                                        ? "bg-[oklch(0.65_0.2_25)]"
                                        : "bg-[oklch(0.8_0.15_90)]"
                                  }`}
                                  style={{ width: `${value * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* State parameters */}
                        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-[9px] font-mono">
                          <div>
                            <span className="text-muted-foreground">
                              μ bull
                            </span>
                            <div className="text-foreground">
                              {(r.stateMeans.bull * 100).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              σ bull
                            </span>
                            <div className="text-foreground">
                              {(r.stateVolatilities.bull * 100).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              μ bear
                            </span>
                            <div className="text-foreground">
                              {(r.stateMeans.bear * 100).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              σ bear
                            </span>
                            <div className="text-foreground">
                              {(r.stateVolatilities.bear * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Cointegration Analysis */}
        {pairs.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-base font-bold tracking-tight font-mono">
                ADF Cointegration
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-0.5">
                Augmented Dickey-Fuller · MacKinnon CVs
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4 text-xs font-mono">
              <span className="text-muted-foreground">
                {pairs.length} pairs tested
              </span>
              <span className="text-border">·</span>
              <span className="text-[oklch(0.72_0.19_160)]">
                {cointegratedPairs.length} cointegrated
              </span>
              <span className="text-muted-foreground">@ 5%</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card/30 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        Pair
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        ADF
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        p-value
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                        CV 5%
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        β hedge
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        t½ days
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        Strength
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        Coint.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs
                      .sort(
                        (a, b) =>
                          a.result.testStatistic < b.result.testStatistic
                            ? -1
                            : 1,
                      )
                      .map((p) => (
                        <tr
                          key={`${p.asset1}-${p.asset2}`}
                          className={`border-b border-border/20 transition-colors hover:bg-muted/20 ${
                            p.result.isCointegrated
                              ? "bg-[oklch(0.72_0.19_160_/_0.03)]"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold font-mono">
                            {p.asset1}
                            <span className="text-muted-foreground mx-1">
                              /
                            </span>
                            {p.asset2}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground">
                            {formatStat(p.result.testStatistic)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground">
                            {p.result.pValue < 0.01
                              ? "<0.01"
                              : p.result.pValue.toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">
                            {formatStat(p.result.criticalValues.pct5)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground hidden md:table-cell">
                            {formatStat(p.result.hedgeRatio)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground hidden lg:table-cell">
                            {p.result.halfLifeDays !== null
                              ? `${p.result.halfLifeDays}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-[10px] font-semibold font-mono ${strengthColor(p.result.strength)}`}
                            >
                              {p.result.strength}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.result.isCointegrated ? (
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-[oklch(0.72_0.19_160_/_0.15)] text-[oklch(0.72_0.19_160)] text-[10px]">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-muted/20 text-muted-foreground text-[10px]">
                                ✗
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reference */}
            <div className="mt-6 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5">
              <h3 className="text-xs font-mono font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                Reference
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-[11px] text-muted-foreground leading-relaxed">
                <div>
                  <p className="font-semibold text-foreground mb-1 font-mono">
                    ADF Statistic
                  </p>
                  <p>
                    More negative than CV 5% → reject unit root → pair is
                    cointegrated.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1 font-mono">
                    Hedge Ratio (β)
                  </p>
                  <p>
                    OLS slope from Y = α + β·X. Units of Y per unit of X for a
                    market-neutral spread.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1 font-mono">
                    Half-Life (t½)
                  </p>
                  <p>
                    Days for the spread to revert halfway to its mean, estimated
                    via Ornstein-Uhlenbeck approximation.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1 font-mono">
                    Strength
                  </p>
                  <p>
                    Strong: p &lt; 0.01 · Moderate: p &lt; 0.05 · Weak: p &lt;
                    0.10 · None: above 10%.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-border/30 pt-6 pb-8 text-center text-[10px] font-mono text-muted-foreground/40">
          AT v1 · CoinGecko 90d · {ALL_COINS.map((c) => c.symbol).join(" · ")}
        </footer>
      </div>
    </main>
  );
}
