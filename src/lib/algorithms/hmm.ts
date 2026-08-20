/**
 * Hidden Markov Model (HMM) Regime Detection
 *
 * Classifies daily log-returns into 3 hidden states:
 *   0 = Bull   (positive drift, low vol)
 *   1 = Neutral (low drift, moderate vol)
 *   2 = Bear   (negative drift, high vol)
 *
 * Uses Baum-Welch (EM) to learn parameters and
 * Viterbi to decode the most-likely state sequence.
 */

const N = 3; // number of hidden states
const MAX_ITER = 60;
const TOL = 1e-6;

// ---------- helpers ----------

function logSumExp(a: number[]): number {
  const max = Math.max(...a);
  if (max === -Infinity) return -Infinity;
  return max + Math.log(a.reduce((s, v) => s + Math.exp(v - max), 0));
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 1e-300;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

// ---------- initialisation ----------

function initParams(returns: number[]) {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  const third = Math.floor(n / 3);

  // Split sorted returns into 3 quintiles for initial means
  const mu = [
    sorted.slice(2 * third).reduce((s, v) => s + v, 0) / (n - 2 * third), // bull (highest)
    sorted.slice(third, 2 * third).reduce((s, v) => s + v, 0) / third,    // neutral
    sorted.slice(0, third).reduce((s, v) => s + v, 0) / third,            // bear (lowest)
  ];

  const sigma = [
    Math.sqrt(sorted.slice(2 * third).reduce((s, v) => s + (v - mu[0]) ** 2, 0) / (n - 2 * third)) || 0.01,
    Math.sqrt(sorted.slice(third, 2 * third).reduce((s, v) => s + (v - mu[1]) ** 2, 0) / third) || 0.01,
    Math.sqrt(sorted.slice(0, third).reduce((s, v) => s + (v - mu[2]) ** 2, 0) / third) || 0.01,
  ];

  // Equal transition probabilities
  const A = Array.from({ length: N }, () => Array(N).fill(1 / N));

  // Equal initial state probabilities
  const pi = Array(N).fill(1 / N);

  return { mu, sigma, A, pi };
}

// ---------- forward-backward ----------

function forward(
  returns: number[],
  mu: number[],
  sigma: number[],
  A: number[][],
  pi: number[],
) {
  const T = returns.length;
  const logAlpha = Array.from({ length: T }, () => Array(N).fill(0));

  for (let j = 0; j < N; j++) {
    logAlpha[0][j] = Math.log(pi[j] + 1e-300) + Math.log(normalPdf(returns[0], mu[j], sigma[j]) + 1e-300);
  }

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      const vals = [];
      for (let i = 0; i < N; i++) {
        vals.push(logAlpha[t - 1][i] + Math.log(A[i][j] + 1e-300));
      }
      logAlpha[t][j] = logSumExp(vals) + Math.log(normalPdf(returns[t], mu[j], sigma[j]) + 1e-300);
    }
  }

  return logAlpha;
}

function backward(
  returns: number[],
  mu: number[],
  sigma: number[],
  A: number[][],
) {
  const T = returns.length;
  const logBeta = Array.from({ length: T }, () => Array(N).fill(0));

  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < N; i++) {
      const vals = [];
      for (let j = 0; j < N; j++) {
        vals.push(
          Math.log(A[i][j] + 1e-300) +
            Math.log(normalPdf(returns[t + 1], mu[j], sigma[j]) + 1e-300) +
            logBeta[t + 1][j],
        );
      }
      logBeta[t][i] = logSumExp(vals);
    }
  }

  return logBeta;
}

// ---------- Baum-Welch EM ----------

function baumWelch(returns: number[]) {
  const T = returns.length;
  let { mu, sigma, A, pi } = initParams(returns);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const logAlpha = forward(returns, mu, sigma, A, pi);
    const logBeta = backward(returns, mu, sigma, A);

    // gamma[t][j] = P(state_t = j | observations)
    const gamma = Array.from({ length: T }, () => Array(N).fill(0));
    for (let t = 0; t < T; t++) {
      const logDenom = logSumExp(logAlpha[t]);
      for (let j = 0; j < N; j++) {
        gamma[t][j] = Math.exp(logAlpha[t][j] + logBeta[t][j] - logDenom);
      }
    }

    // xi[t][i][j] = P(state_t = i, state_{t+1} = j | observations)
    const xi = Array.from({ length: T - 1 }, () =>
      Array.from({ length: N }, () => Array(N).fill(0)),
    );

    for (let t = 0; t < T - 1; t++) {
      let logDenom = -Infinity;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const val =
            logAlpha[t][i] +
            Math.log(A[i][j] + 1e-300) +
            Math.log(normalPdf(returns[t + 1], mu[j], sigma[j]) + 1e-300) +
            logBeta[t + 1][j];
          xi[t][i][j] = Math.exp(val);
          logDenom = logDenom === -Infinity ? val : logSumExp([logDenom, val]);
        }
      }
      // normalise
      let total = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) total += xi[t][i][j];
      if (total > 0) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) xi[t][i][j] /= total;
    }

    // Re-estimate pi
    for (let j = 0; j < N; j++) pi[j] = gamma[0][j];

    // Re-estimate A
    for (let i = 0; i < N; i++) {
      let denom = 0;
      for (let t = 0; t < T - 1; t++) denom += gamma[t][i];
      for (let j = 0; j < N; j++) {
        let numer = 0;
        for (let t = 0; t < T - 1; t++) numer += xi[t][i][j];
        A[i][j] = denom > 0 ? numer / denom : 1 / N;
      }
    }

    // Re-estimate mu and sigma
    for (let j = 0; j < N; j++) {
      let denom = 0;
      let numerMu = 0;
      for (let t = 0; t < T; t++) {
        denom += gamma[t][j];
        numerMu += gamma[t][j] * returns[t];
      }
      mu[j] = denom > 0 ? numerMu / denom : 0;

      let numerSigma = 0;
      for (let t = 0; t < T; t++) {
        numerSigma += gamma[t][j] * (returns[t] - mu[j]) ** 2;
      }
      sigma[j] = denom > 0 ? Math.sqrt(numerSigma / denom) : 0.01;
      if (sigma[j] < 1e-6) sigma[j] = 1e-6;
    }
  }

  return { mu, sigma, A, pi };
}

// ---------- Viterbi decoding ----------

function viterbi(
  returns: number[],
  mu: number[],
  sigma: number[],
  A: number[][],
  pi: number[],
): number[] {
  const T = returns.length;
  const delta = Array.from({ length: T }, () => Array(N).fill(0));
  const psi = Array.from({ length: T }, () => Array(N).fill(0));

  for (let j = 0; j < N; j++) {
    delta[0][j] = Math.log(pi[j] + 1e-300) + Math.log(normalPdf(returns[0], mu[j], sigma[j]) + 1e-300);
  }

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let bestVal = -Infinity;
      let bestI = 0;
      for (let i = 0; i < N; i++) {
        const val = delta[t - 1][i] + Math.log(A[i][j] + 1e-300);
        if (val > bestVal) {
          bestVal = val;
          bestI = i;
        }
      }
      delta[t][j] = bestVal + Math.log(normalPdf(returns[t], mu[j], sigma[j]) + 1e-300);
      psi[t][j] = bestI;
    }
  }

  // back-track
  const states = Array(T).fill(0);
  let bestLast = 0;
  for (let j = 1; j < N; j++) {
    if (delta[T - 1][j] > delta[T - 1][bestLast]) bestLast = j;
  }
  states[T - 1] = bestLast;
  for (let t = T - 2; t >= 0; t--) {
    states[t] = psi[t + 1][states[t + 1]];
  }

  return states;
}

// ---------- label mapping ----------

function labelStates(
  mu: number[],
  states: number[],
): { regimeMap: Record<number, string>; labeled: string[]; mu: number[]; sigma: number[] } {
  // Sort state indices by their mu: lowest mu → Bear, highest → Bull
  const order = [0, 1, 2].sort((a, b) => mu[a] - mu[b]);
  const regimeMap: Record<number, string> = {
    [order[0]]: "Bear",
    [order[1]]: "Neutral",
    [order[2]]: "Bull",
  };
  const labeled = states.map((s) => regimeMap[s]);
  const sortedMu = order.map((i) => mu[i]);
  const sortedSigma = order.map((i) => mu[i]); // placeholder, replaced below
  return { regimeMap, labeled, mu: mu, sigma: [] };
}

// ---------- public API ----------

export interface RegimeResult {
  /** Daily regime labels: "Bull" | "Bear" | "Neutral" */
  regimes: string[];
  /** Most recent regime */
  currentRegime: string;
  /** Confidence (% of time in current regime over last 20 days) */
  currentConfidence: number;
  /** Regime distribution over entire period */
  regimeDistribution: { bull: number; bear: number; neutral: number };
  /** Learned means per state (ordered bull/neutral/bear) */
  stateMeans: { bull: number; neutral: number; bear: number };
  /** Learned volatility per state */
  stateVolatilities: { bull: number; neutral: number; bear: number };
}

export function runHMM(prices: number[]): RegimeResult {
  const T = prices.length;
  if (T < 10) throw new Error("Need at least 10 data points for HMM");

  // Compute log returns
  const returns: number[] = [];
  for (let i = 1; i < T; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  // Run Baum-Welch
  const { mu, sigma, A, pi } = baumWelch(returns);

  // Viterbi decode
  const rawStates = viterbi(returns, mu, sigma, A, pi);

  // Sort states by mu to label them
  const indicesByMu = [0, 1, 2].sort((a, b) => mu[a] - mu[b]);
  // indicesByMu[0] = Bear, [1] = Neutral, [2] = Bull
  const stateLabels: Record<number, string> = {
    [indicesByMu[0]]: "Bear",
    [indicesByMu[1]]: "Neutral",
    [indicesByMu[2]]: "Bull",
  };

  const regimes = rawStates.map((s) => stateLabels[s]);
  const currentRegime = regimes[regimes.length - 1];

  // Confidence: proportion of current regime in last 20 days
  const windowSize = Math.min(20, regimes.length);
  const recentRegimes = regimes.slice(-windowSize);
  const currentConfidence =
    recentRegimes.filter((r) => r === currentRegime).length / windowSize;

  // Distribution
  const counts = { Bull: 0, Bear: 0, Neutral: 0 };
  for (const r of regimes) counts[r as keyof typeof counts]++;
  const regimeDistribution = {
    bull: counts.Bull / regimes.length,
    bear: counts.Bear / regimes.length,
    neutral: counts.Neutral / regimes.length,
  };

  return {
    regimes,
    currentRegime,
    currentConfidence,
    regimeDistribution,
    stateMeans: {
      bull: mu[indicesByMu[2]],
      neutral: mu[indicesByMu[1]],
      bear: mu[indicesByMu[0]],
    },
    stateVolatilities: {
      bull: sigma[indicesByMu[2]],
      neutral: sigma[indicesByMu[1]],
      bear: sigma[indicesByMu[0]],
    },
  };
}
