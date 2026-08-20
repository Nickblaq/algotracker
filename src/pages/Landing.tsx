import { motion } from "framer-motion";
import { Activity, TrendingUp, Shield, Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: Activity,
    title: "HMM Regime Detection",
    desc: "Hidden Markov Models classify the market into Bull, Bear, and Neutral regimes using unsupervised pattern recognition on daily returns.",
    color: "text-[oklch(0.72_0.19_160)]",
    bg: "bg-[oklch(0.72_0.19_160_/_0.08)]",
  },
  {
    icon: Shield,
    title: "ADF Cointegration Test",
    desc: "Augmented Dickey-Fuller analysis statistically validates whether asset pairs move together long-term — the foundation of pairs trading.",
    color: "text-[oklch(0.72_0.19_210)]",
    bg: "bg-[oklch(0.72_0.19_210_/_0.08)]",
  },
  {
    icon: TrendingUp,
    title: "5-Asset Coverage",
    desc: "Bitcoin, Ethereum, Solana, XRP, and Dogecoin analyzed simultaneously — 10 pair combinations tested for cointegration.",
    color: "text-[oklch(0.8_0.15_90)]",
    bg: "bg-[oklch(0.8_0.15_90_/_0.08)]",
  },
  {
    icon: Zap,
    title: "Real-Time Data",
    desc: "Live price feeds from CoinGecko with 90-day historical windows powering both algorithms for statistically meaningful results.",
    color: "text-[oklch(0.72_0.19_180)]",
    bg: "bg-[oklch(0.72_0.19_180_/_0.08)]",
  },
];

const stats = [
  { label: "Algorithms", value: "2" },
  { label: "Assets Tracked", value: "5" },
  { label: "Pair Combinations", value: "10" },
  { label: "Data Window", value: "90d" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient gradient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[oklch(0.72_0.19_180_/_0.06)] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-[oklch(0.72_0.19_160_/_0.05)] blur-[100px]" />
        <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] rounded-full bg-[oklch(0.65_0.2_25_/_0.04)] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/50">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 text-primary">
              <Activity className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Crypto<span className="text-primary">Alpha</span>
            </span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Launch Dashboard
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Statistical Market Intelligence
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
            Detect Regimes.
            <br />
            <span className="text-primary">Validate Pairs.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Hidden Markov Models classify the current market state.
            Augmented Dickey-Fuller tests confirm whether asset pairs
            are statistically cointegrated. All powered by live data from the top 5 cryptocurrencies.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:shadow-[0_0_30px_oklch(0.72_0.19_180_/_0.3)]"
            >
              View Analysis Results
              <ChevronRight className="size-4" />
            </Link>
            <a
              href="#algorithms"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-border"
            >
              How It Works
            </a>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={item}
              className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-5"
            >
              <div className="text-3xl font-bold font-mono text-foreground">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Algorithms Section */}
      <section
        id="algorithms"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Two Algorithms.{" "}
            <span className="text-primary">One Dashboard.</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Each algorithm answers a different question about the market.
            Together they give you a complete statistical picture.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 transition-all hover:border-border/70 hover:bg-card/80"
            >
              <div
                className={`flex items-center justify-center size-10 rounded-lg ${feat.bg} ${feat.color} mb-4`}
              >
                <feat.icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feat.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-8 sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight mb-8 text-center">
            How the Dashboard Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Fetch Data",
                desc: "90 days of daily closing prices pulled live from CoinGecko for BTC, ETH, SOL, XRP, and DOGE.",
              },
              {
                step: "02",
                title: "Run Analysis",
                desc: "HMM classifies each day into Bull/Bear/Neutral. ADF tests all 10 pair combinations for cointegration.",
              },
              {
                step: "03",
                title: "Read Results",
                desc: "See the current regime for each asset, and which pairs are statistically valid for pairs trading.",
              },
            ].map((s, i) => (
              <div key={s.step} className="text-center sm:text-left">
                <div className="text-4xl font-black text-primary/20 font-mono mb-2">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Launch Analysis
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <p>
          CryptoAlpha v1 — HMM Regime Detection & ADF Cointegration Analysis
        </p>
        <p className="mt-1">
          Data from CoinGecko. Not financial advice.
        </p>
      </footer>
    </div>
  );
}
