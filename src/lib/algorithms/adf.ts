/**
 * Augmented Dickey-Fuller (ADF) Test for Cointegration
 *
 * Tests whether two non-stationary price series share a
 * long-run equilibrium (are cointegrated).
 *
 * Procedure:
 *  1. Run OLS regression: Y_t = α + β·X_t + ε_t
 *  2. Compute residuals ε_t
 *  3. Run ADF on residuals: Δε_t = γ·ε_{t-1} + Σ δ_i·Δε_{t-i} + u_t
 *  4. If γ is significantly negative → reject unit root → series are cointegrated
 */

// ---------- OLS helpers ----------

interface OLSResult {
  alpha: number;
  beta: number;
  residuals: number[];
}

function olsRegression(x: number[], y: number[]): OLSResult {
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - meanX) * (y[i] - meanY);
    ssXX += (x[i] - meanX) ** 2;
  }

  const beta = ssXX > 0 ? ssXY / ssXX : 0;
  const alpha = meanY - beta * meanX;

  const residuals = y.map((yi, i) => yi - (alpha + beta * x[i]));

  return { alpha, beta, residuals };
}

// ---------- ADF regression ----------

interface ADFRegressionResult {
  gamma: number; // coefficient on lagged level (the key test stat)
  seGamma: number;
  tStat: number;
  residuals: number[];
}

function adfRegress(residuals: number[], maxLag: number): ADFRegressionResult {
  const T = residuals.length;
  const lag = Math.min(maxLag, Math.floor(Math.pow(T, 1 / 3)));

  // Dependent: Δε_t
  // Regressors: ε_{t-1}, Δε_{t-1}, ..., Δε_{t-lag}
  const nObs = T - lag - 1;
  if (nObs < lag + 2) {
    return { gamma: 0, seGamma: 1, tStat: 0, residuals: [] };
  }

  const yArr: number[] = [];
  const xArr: number[][] = [];

  for (let t = lag + 1; t < T; t++) {
    yArr.push(residuals[t] - residuals[t - 1]); // Δε_t
    const row = [residuals[t - 1]]; // ε_{t-1}
    for (let j = 1; j <= lag; j++) {
      row.push(residuals[t - j] - residuals[t - j - 1]); // Δε_{t-j}
    }
    xArr.push(row);
  }

  // OLS via normal equations: (X'X)^{-1} X'y
  const n = yArr.length;
  const k = xArr[0].length;

  // X'X
  const XtX = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let t = 0; t < n; t++) sum += xArr[t][i] * xArr[t][j];
      XtX[i][j] = sum;
    }
  }

  // X'y
  const Xty = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    let sum = 0;
    for (let t = 0; t < n; t++) sum += xArr[t][i] * yArr[t];
    Xty[i] = sum;
  }

  // Solve via Gauss elimination
  const aug = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < k; i++) {
    // pivot
    let maxRow = i;
    for (let r = i + 1; r < k; r++) {
      if (Math.abs(aug[r][i]) > Math.abs(aug[maxRow][i])) maxRow = r;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    const pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let j = i; j <= k; j++) aug[i][j] /= pivot;
    for (let r = 0; r < k; r++) {
      if (r === i) continue;
      const factor = aug[r][i];
      for (let j = i; j <= k; j++) aug[r][j] -= factor * aug[i][j];
    }
  }

  const beta = aug.map((row) => row[k]);
  const gamma = beta[0];

  // Residual variance and SE
  let ssRes = 0;
  for (let t = 0; t < n; t++) {
    let pred = 0;
    for (let j = 0; j < k; j++) pred += xArr[t][j] * beta[j];
    ssRes += (yArr[t] - pred) ** 2;
  }
  const s2 = n > k ? ssRes / (n - k) : 1e-10;

  // SE of gamma = sqrt(s2 * (X'X)^{-1}_{0,0})
  const invDiag0 = 1 / (XtX[0][0] + 1e-15); // simplified: just use diagonal
  const seGamma = Math.sqrt(Math.abs(s2 * invDiag0));
  const tStat = seGamma > 0 ? gamma / seGamma : 0;

  return { gamma, seGamma, tStat, residuals: yArr };
}

// ---------- Critical values (Engle-Granger approximation) ----------

// MacKinnon approximate critical values for ADF test with intercept
// Source: MacKinnon (1994) — table for cointegration tests
function adfCriticalValues(n: number): { pct1: number; pct5: number; pct10: number } {
  // Approximate MacKinnon critical values for N=∞ (cointegration)
  // These are well-established constants in econometrics
  if (n > 250) return { pct1: -3.90, pct5: -3.34, pct10: -3.04 };
  if (n > 100) return { pct1: -3.96, pct5: -3.37, pct10: -3.07 };
  if (n > 50) return { pct1: -4.07, pct5: -3.43, pct10: -3.12 };
  if (n > 30) return { pct1: -4.15, pct5: -3.49, pct10: -3.17 };
  return { pct1: -4.32, pct5: -3.59, pct10: -3.25 };
}

// ---------- public API ----------

export type CointegrationStrength = "Strong" | "Moderate" | "Weak" | "None";

export interface ADFResult {
  /** Whether the pair is cointegrated (rejects unit root at 5% level) */
  isCointegrated: boolean;
  /** ADF test statistic */
  testStatistic: number;
  /** p-value approximation */
  pValue: number;
  /** Critical values at 1%, 5%, 10% */
  criticalValues: { pct1: number; pct5: number; pct10: number };
  /** Hedge ratio (β from OLS: Y = α + βX) */
  hedgeRatio: number;
  /** Intercept (α from OLS) */
  intercept: number;
  /** Strength classification */
  strength: CointegrationStrength;
  /** Half-life of mean reversion (approximation) */
  halfLifeDays: number | null;
}

export function runADFTest(pricesX: number[], pricesY: number[]): ADFResult {
  if (pricesX.length !== pricesY.length) throw new Error("Price arrays must be same length");
  if (pricesX.length < 30) throw new Error("Need at least 30 data points for ADF test");

  const T = pricesX.length;

  // Step 1: OLS regression Y = α + β·X + ε
  const { alpha, beta, residuals } = olsRegression(pricesX, pricesY);

  // Step 2-3: ADF test on residuals
  const maxLag = Math.min(12, Math.floor(T / 3));
  const { gamma, tStat } = adfRegress(residuals, maxLag);

  // Step 4: Critical values and decision
  const cv = adfCriticalValues(T);

  const isCointegrated = tStat < cv.pct5;
  const isStrong = tStat < cv.pct1;
  const isModerate = tStat < cv.pct5;
  const isWeak = tStat < cv.pct10;

  let strength: CointegrationStrength;
  if (isStrong) strength = "Strong";
  else if (isModerate) strength = "Moderate";
  else if (isWeak) strength = "Weak";
  else strength = "None";

  // Approximate p-value using MacKinnon approximation
  // Simple linear interpolation between critical values
  let pValue: number;
  if (tStat < cv.pct1) pValue = 0.005;
  else if (tStat < cv.pct5) pValue = 0.01 + ((cv.pct1 - tStat) / (cv.pct1 - cv.pct5)) * 0.04;
  else if (tStat < cv.pct10) pValue = 0.05 + ((cv.pct5 - tStat) / (cv.pct5 - cv.pct10)) * 0.05;
  else pValue = 0.10 + Math.min(0.40, (cv.pct10 - tStat) / 5);

  // Half-life of mean reversion from Ornstein-Uhlenbeck approximation
  let halfLifeDays: number | null = null;
  if (gamma < 0) {
    const halfLife = -Math.log(2) / gamma;
    if (halfLife > 0 && halfLife < 500) halfLifeDays = Math.round(halfLife);
  }

  return {
    isCointegrated,
    testStatistic: tStat,
    pValue,
    criticalValues: cv,
    hedgeRatio: beta,
    intercept: alpha,
    strength,
    halfLifeDays,
  };
}

export interface PairResult {
  asset1: string;
  asset2: string;
  result: ADFResult;
}
