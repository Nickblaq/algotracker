import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Link } from "react-router";

const methods = [
  {
    label: "HMM Regime Detection",
    detail:
      "Baum-Welch EM estimates transition matrices and emission parameters. Viterbi decoding labels each day as Bull, Bear, or Neutral based on learned state dynamics.",
  },
  {
    label: "ADF Cointegration Test",
    detail:
      "OLS regression followed by Augmented Dickey-Fuller on residuals. MacKinnon critical values at 1%, 5%, 10%. Hedge ratios and Ornstein-Uhlenbeck half-life estimates included.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[oklch(0.72_0.19_180_/_0.06)] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-[oklch(0.72_0.19_160_/_0.05)] blur-[100px]" />
      </div>

      <nav className="relative z-10 border-b border-border/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 text-primary">
              <Activity className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight font-mono">
              AT
            </span>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono">
            AT
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground leading-relaxed">
            Regime detection and cointegration analysis for the top five
            cryptocurrencies by market cap. Hidden Markov Models classify
            daily market states; Augmented Dickey-Fuller tests validate
            whether pairs trade share a long-run equilibrium.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {methods.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-border/40 bg-card/50 p-5"
              >
                <div className="text-sm font-semibold font-mono text-primary mb-2">
                  {m.label}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {m.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-xs text-muted-foreground/50 space-y-1">
            <p>
              Data source: CoinGecko · configurable window (1d, 7d, 30d, 90d) · daily close prices
            </p>
            <p>
              Assets: BTC, ETH, SOL, XRP, HYPE · 10 pair combinations
            </p>
          </div>

          <div className="mt-10">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:shadow-[0_0_25px_oklch(0.72_0.19_180_/_0.25)]"
            >
              Run Analysis →
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/30 py-6 text-center text-[10px] text-muted-foreground/40">
        AT v1
      </footer>
    </div>
  );
}
