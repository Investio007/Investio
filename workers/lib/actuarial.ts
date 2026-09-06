/**
 * Crowth Actuarial AI Engine — Cloudflare Workers (TypeScript)
 * Hardy / Lo / Hull / Barucci / Wüthrich / Boudreault
 * Pure JS math (replaces numpy/scipy). Response shape matches FastAPI + frontend.
 */

import { fetchChart, fetchQuote } from "./finnhub";
import { resolveTicker, toFinnhubSymbol } from "./symbols";

const SA_REPO_RATE = 0.0825;
const GLOBAL_MARKET_RETURN = 0.1;
const SA_MARKET_SIGMA = 0.16;
const FINNHUB_BASE = "https://finnhub.io/api/v1";

// ─── Math utilities (Abramowitz & Stegun / Beasley-Springer-Moro) ────────────

export function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

export function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function normPPF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function logReturns(prices: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      rets.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return rets;
}

// ─── Layer 1: Return Modelling (Hardy 2003, Ch. 2) ───────────────────────────

function calcReturnStats(prices: number[]) {
  const rets = logReturns(prices);
  if (rets.length < 10) {
    return {
      mu: 0.08,
      sigma: 0.2,
      annual_expected_return: 8.0,
      annual_volatility: 20.0,
      sharpe_ratio: 0.0,
      sortino_ratio: 0.0,
      max_drawdown: -15.0,
      skewness: 0.0,
      excess_kurtosis: 0.0,
      data_points: 0,
      source: "Fallback values — insufficient price history",
    };
  }

  const muDaily = mean(rets);
  const sigmaDaily = std(rets);
  const mu = muDaily * 252;
  const sigma = sigmaDaily * Math.sqrt(252);
  const rf = SA_REPO_RATE / 252;
  const sharpe =
    sigmaDaily > 0 ? ((muDaily - rf) / sigmaDaily) * Math.sqrt(252) : 0;

  const downside = rets.filter((r) => r < 0);
  const downsideDev =
    downside.length > 1 ? std(downside) * Math.sqrt(252) : sigma;
  const sortino = downsideDev > 0 ? (mu - SA_REPO_RATE) / downsideDev : 0;

  let peak = -Infinity;
  let maxDD = 0;
  let cum = 1;
  for (const r of rets) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    const dd = (cum - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  let skewness = 0;
  let excessKurtosis = 0;
  if (sigmaDaily > 0) {
    skewness = mean(rets.map((r) => ((r - muDaily) / sigmaDaily) ** 3));
    excessKurtosis =
      mean(rets.map((r) => ((r - muDaily) / sigmaDaily) ** 4)) - 3;
  }

  return {
    mu,
    sigma,
    annual_expected_return: round(mu * 100, 2),
    annual_volatility: round(sigma * 100, 2),
    sharpe_ratio: round(sharpe, 3),
    sortino_ratio: round(sortino, 3),
    max_drawdown: round(maxDD * 100, 2),
    skewness: round(skewness, 3),
    excess_kurtosis: round(excessKurtosis, 3),
    data_points: rets.length,
    source: "Hardy (2003) Ch. 2 — Lognormal return model",
  };
}

// ─── Layer 2: VaR / CTE (Hardy 2003, Ch. 4-5) ────────────────────────────────

function calcVaRCTE(
  mu: number,
  sigma: number,
  investment: number,
  horizonYears = 1,
  confidence = 0.95,
) {
  const sig = sigma > 0 ? sigma : 0.001;
  const alpha = 1 - confidence;
  const muT = (mu - 0.5 * sig ** 2) * horizonYears;
  const sigmaT = sig * Math.sqrt(horizonYears);
  const zAlpha = normPPF(alpha);

  const varRatio = Math.exp(muT + sigmaT * zAlpha);
  const varLoss = Math.max(0, investment - investment * varRatio);

  const phiAdj = normCDF(zAlpha - sigmaT);
  const cteMean =
    (investment * Math.exp(muT + 0.5 * sigmaT ** 2) * phiAdj) / alpha;
  const cteLoss = Math.max(0, investment - cteMean);

  const probLoss = sigmaT > 0 ? normCDF(-muT / sigmaT) : 0.5;
  const expectedValue = investment * Math.exp(mu * horizonYears);
  const probDouble =
    sigmaT > 0 ? 1 - normCDF((Math.log(2) - muT) / sigmaT) : 0;

  const z01 = normPPF(0.01);
  const extremeLoss = Math.max(
    0,
    investment - investment * Math.exp(muT + sigmaT * z01),
  );

  return {
    var_95: round(varLoss, 2),
    cte_95: round(cteLoss, 2),
    extreme_loss_1pct: round(extremeLoss, 2),
    prob_loss_pct: round(probLoss * 100, 1),
    prob_double_pct: round(probDouble * 100, 1),
    expected_terminal_value: round(expectedValue, 2),
    horizon_years: horizonYears,
    confidence,
    source: "Hardy (2003) Ch. 4-5 — VaR and CTE under lognormal model",
  };
}

function calcMultiHorizon(mu: number, sigma: number, investment: number) {
  return [1, 3, 5, 10].map((years) => {
    const r = calcVaRCTE(mu, sigma, investment, years);
    return {
      horizon: `${years}Y`,
      years,
      var_95: r.var_95,
      cte_95: r.cte_95,
      expected_value: r.expected_terminal_value,
      prob_loss: r.prob_loss_pct,
    };
  });
}

// ─── Layer 3: Black-Scholes (Lo / Hull / Boudreault) ─────────────────────────

function calcBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
) {
  if (sigma <= 0 || T <= 0 || S <= 0 || K <= 0) {
    return {
      call_price: 0,
      put_price: 0,
      risk_neutral_prob_gain_pct: 50,
      risk_neutral_prob_loss_pct: 50,
      downside_protection_cost_pct: 5,
      downside_protection_cost_rand: S * 0.05,
      delta: 0.5,
      gamma: 0,
      vega_per_1pct_vol: 0,
      theta_per_day: 0,
      put_call_ratio: 1,
      strike: S,
      horizon_years: T,
      source: "Fallback values — insufficient data for BSM",
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);

  const call = S * normCDF(d1) - K * disc * normCDF(d2);
  const put = K * disc * normCDF(-d2) - S * normCDF(-d1);
  const probGain = normCDF(d2);
  const protCostPct = (put / S) * 100;
  const gamma = normPDF(d1) / (S * sigma * sqrtT);
  const vega = (S * normPDF(d1) * sqrtT) / 100;
  const theta =
    (-S * normPDF(d1) * sigma) / (2 * sqrtT) -
    r * K * disc * normCDF(d2);

  return {
    call_price: round(call, 4),
    put_price: round(put, 4),
    risk_neutral_prob_gain_pct: round(probGain * 100, 1),
    risk_neutral_prob_loss_pct: round((1 - probGain) * 100, 1),
    downside_protection_cost_pct: round(protCostPct, 2),
    downside_protection_cost_rand: round(put, 2),
    delta: round(normCDF(d1), 4),
    gamma: round(gamma, 6),
    vega_per_1pct_vol: round(vega, 4),
    theta_per_day: round(theta / 365, 4),
    put_call_ratio: call > 0.001 ? round(put / call, 3) : 1,
    strike: K,
    horizon_years: T,
    source:
      "Lo (2018) Ch. 5-7 | Hull (2018) Ch. 15 | Boudreault & Renaud (2019) Ch. 8",
  };
}

// ─── Layer 4: CAPM (Barucci & Fontana 2017, Ch. 5) ────────────────────────────

function calcCAPM(stockReturn: number, betaIn: number) {
  const beta = !betaIn || betaIn === 0 ? 1 : betaIn;
  const rf = SA_REPO_RATE;
  const rm = GLOBAL_MARKET_RETURN;
  const marketPremium = rm - rf;
  const capmExpected = rf + beta * marketPremium;
  const alpha = stockReturn - capmExpected;
  const treynor = beta !== 0 ? (stockReturn - rf) / beta : 0;
  const informationRatio = alpha / 0.15;
  const marketPriceOfRisk = marketPremium / SA_MARKET_SIGMA;

  let alpha_label: string;
  let alpha_color: string;
  if (alpha > 0.03) {
    alpha_label = "Earning more than its risk deserves — potential opportunity";
    alpha_color = "green";
  } else if (alpha > 0) {
    alpha_label = "Fairly priced — earning roughly what its risk deserves";
    alpha_color = "green";
  } else if (alpha > -0.03) {
    alpha_label = "Slightly below what its risk deserves — neutral";
    alpha_color = "gold";
  } else {
    alpha_label = "Earning less than its risk deserves — be cautious";
    alpha_color = "red";
  }

  return {
    capm_expected_return_pct: round(capmExpected * 100, 2),
    actual_return_pct: round(stockReturn * 100, 2),
    alpha_pct: round(alpha * 100, 2),
    alpha_label,
    alpha_color,
    beta: round(beta, 3),
    market_price_of_risk: round(marketPriceOfRisk, 3),
    treynor_ratio: round(treynor, 3),
    information_ratio: round(informationRatio, 3),
    market_premium_pct: round(marketPremium * 100, 2),
    source: "Barucci & Fontana (2017) Ch. 5 — CAPM and Jensen's Alpha",
  };
}

// ─── Layer 5: Regime (Hardy 2003, Ch. 7) ─────────────────────────────────────

function detectRegime(prices: number[]) {
  if (prices.length < 30) {
    return {
      regime: "NEUTRAL",
      simple_label: "Mixed Market",
      description: "Not enough data to detect the market mood right now.",
      advice: "Normal caution applies.",
      color: "gold",
      confidence: 0.5,
      recent_volatility: 20,
      long_term_volatility: 20,
      volatility_ratio: 1,
      recent_trend_pct: 0,
      above_200day_ma: true,
      source: "Fallback: Insufficient price history for regime detection",
    };
  }

  const rets = logReturns(prices);
  if (rets.length < 20) {
    return detectRegime([]);
  }

  const recentVol = std(rets.slice(-20)) * Math.sqrt(252);
  const longVol = std(rets) * Math.sqrt(252);
  const nTrend = Math.min(63, rets.length);
  const recentTrend = mean(rets.slice(-nTrend)) * 252;
  const volRatio = longVol > 0 ? recentVol / longVol : 1;

  const currentPrice = prices[prices.length - 1];
  let above200 = true;
  let maSignal = 0;
  if (prices.length >= 200) {
    const ma200 =
      prices.slice(-200).reduce((s, p) => s + p, 0) / 200;
    above200 = currentPrice > ma200;
    maSignal = (currentPrice - ma200) / ma200;
  }

  let bull = 0;
  let bear = 0;
  if (recentTrend > 0.08) bull += 2;
  else if (recentTrend > 0.02) bull += 1;
  else if (recentTrend < -0.1) bear += 2;
  else if (recentTrend < -0.02) bear += 1;

  if (volRatio < 0.9) bull += 1;
  else if (volRatio > 1.4) bear += 2;
  else if (volRatio > 1.2) bear += 1;

  if (above200) bull += 1;
  else bear += 1;

  if (maSignal > 0.05) bull += 1;
  else if (maSignal < -0.05) bear += 1;

  if (bull >= 4 && bear <= 1) {
    return {
      regime: "BULL",
      simple_label: "Growing Market",
      description: "Prices have been going up. The market feels calm.",
      advice: "A growing market can be a good time to invest for the long term.",
      color: "green",
      confidence: round(Math.min(0.85, 0.55 + bull * 0.06), 2),
      recent_volatility: round(recentVol * 100, 1),
      long_term_volatility: round(longVol * 100, 1),
      volatility_ratio: round(volRatio, 2),
      recent_trend_pct: round(recentTrend * 100, 1),
      above_200day_ma: above200,
      source:
        "Hardy (2003) Ch. 7 — Two-state regime-switching model (simplified)",
    };
  }

  if (bear >= 4 && bull <= 1) {
    return {
      regime: "BEAR",
      simple_label: "Falling Market",
      description: "Prices have been going down. There is more risk right now.",
      advice: "Be careful. Invest smaller amounts, or wait.",
      color: "red",
      confidence: round(Math.min(0.82, 0.52 + bear * 0.06), 2),
      recent_volatility: round(recentVol * 100, 1),
      long_term_volatility: round(longVol * 100, 1),
      volatility_ratio: round(volRatio, 2),
      recent_trend_pct: round(recentTrend * 100, 1),
      above_200day_ma: above200,
      source:
        "Hardy (2003) Ch. 7 — Two-state regime-switching model (simplified)",
    };
  }

  return {
    regime: "NEUTRAL",
    simple_label: "Mixed Market",
    description: "Some stocks are up and some are down. That is normal.",
    advice: "Stick to your plan. Do not panic.",
    color: "gold",
    confidence: 0.5,
    recent_volatility: round(recentVol * 100, 1),
    long_term_volatility: round(longVol * 100, 1),
    volatility_ratio: round(volRatio, 2),
    recent_trend_pct: round(recentTrend * 100, 1),
    above_200day_ma: above200,
    source:
      "Hardy (2003) Ch. 7 — Two-state regime-switching model (simplified)",
  };
}

// ─── Layer 6: Score (Wüthrich 2016) ──────────────────────────────────────────

function calcScore(
  var95: number,
  alphaPct: number,
  sharpe: number,
  regime: string,
  regimeConf: number,
  investment: number,
  probLoss: number,
  rnpGain: number,
) {
  const varPct = investment > 0 ? (var95 / investment) * 100 : 20;
  let riskScore =
    varPct <= 10
      ? 90
      : varPct <= 20
        ? 80 - (varPct - 10) * 2
        : varPct <= 35
          ? 60 - (varPct - 20) * 2
          : varPct <= 50
            ? 30 - (varPct - 35)
            : 10;
  riskScore = Math.max(5, Math.min(95, riskScore));
  if (probLoss > 40) riskScore *= 0.8;
  else if (probLoss > 30) riskScore *= 0.9;

  const alphaScore =
    alphaPct >= 5
      ? 90
      : alphaPct >= 3
        ? 80
        : alphaPct >= 1
          ? 70
          : alphaPct >= 0
            ? 60
            : alphaPct >= -2
              ? 45
              : alphaPct >= -5
                ? 30
                : 15;

  let sharpeScore =
    sharpe >= 1.5
      ? 95
      : sharpe >= 1.0
        ? 85
        : sharpe >= 0.7
          ? 75
          : sharpe >= 0.5
            ? 65
            : sharpe >= 0.3
              ? 55
              : sharpe >= 0
                ? 45
                : sharpe >= -0.3
                  ? 30
                  : 15;
  if (rnpGain > 65) sharpeScore = Math.min(95, sharpeScore + 5);
  else if (rnpGain < 40) sharpeScore = Math.max(5, sharpeScore - 5);

  const baseRegime =
    regime === "BULL" ? 80 : regime === "BEAR" ? 25 : 55;
  const regimeScore = baseRegime * regimeConf + 55 * (1 - regimeConf);

  const final = Math.max(
    5,
    Math.min(
      95,
      Math.round(
        riskScore * 0.35 +
          alphaScore * 0.25 +
          sharpeScore * 0.25 +
          regimeScore * 0.15,
      ),
    ),
  );

  const color = final >= 65 ? "green" : final >= 45 ? "gold" : "red";
  const label =
    final >= 65
      ? "Looks Good to Invest"
      : final >= 45
        ? "Could Be Worth It"
        : "Too Risky Right Now";
  const summary =
    final >= 65
      ? "This stock looks okay to invest in right now."
      : final >= 45
        ? "There are good parts and risky parts. Go slow."
        : "This stock looks too risky right now.";

  return {
    score: final,
    color,
    label,
    summary,
    components: {
      risk: Math.round(riskScore),
      alpha: Math.round(alphaScore),
      sharpe: Math.round(sharpeScore),
      regime: Math.round(regimeScore),
    },
    weights: { risk: "35%", alpha: "25%", sharpe: "25%", regime: "15%" },
    source:
      "Wüthrich (2016) Market-Consistent Actuarial Valuation — weighted scoring framework",
  };
}

// ─── Plain English (Grade 9 / beginner — max 5 short sentences) ───────────────

function translateToEnglish(
  metrics: {
    annual_expected_return: number;
    annual_volatility: number;
    var_95: number;
    prob_loss_pct: number;
    expected_terminal_value: number;
    alpha_pct: number;
    description?: string;
    advice?: string;
    risk_neutral_prob_gain_pct: number;
    downside_protection_cost_pct: number;
    sharpe_ratio: number;
  },
  investment: number,
): string[] {
  const lines: string[] = [];
  const inv = `R${investment.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
  const er = metrics.annual_expected_return;
  const vol = metrics.annual_volatility;
  const prob = metrics.prob_loss_pct;
  const ev = metrics.expected_terminal_value;
  const gain = ev - investment;
  const evLabel = `R${ev.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
  const gainLabel = `R${Math.abs(gain).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;

  // 1) Growth
  if (er >= 12) {
    lines.push(
      `This stock could grow by about ${er.toFixed(0)}% in a year. That is strong growth.`,
    );
  } else if (er >= 0) {
    lines.push(
      `This stock could grow by about ${er.toFixed(0)}% in a year. Slow but steady.`,
    );
  } else {
    lines.push(
      `This stock may fall by about ${Math.abs(er).toFixed(0)}% in a year. That is a warning sign.`,
    );
  }

  // 2) Price calm / bumpy
  if (vol >= 35) {
    lines.push(
      `The price jumps up and down a lot (about ${vol.toFixed(0)}% a year). It can feel scary.`,
    );
  } else if (vol >= 20) {
    lines.push(
      `The price moves about ${vol.toFixed(0)}% a year. Normal ups and downs for a stock.`,
    );
  } else {
    lines.push(
      `The price is fairly calm (about ${vol.toFixed(0)}% a year). Less scary than most stocks.`,
    );
  }

  // 3) Chance of loss
  if (prob >= 40) {
    lines.push(
      `There is about a ${prob.toFixed(0)}% chance of losing money in one year. That is quite high.`,
    );
  } else {
    lines.push(
      `There is about a ${prob.toFixed(0)}% chance of losing money in one year.`,
    );
  }

  // 4) Simple money outcome
  if (gain >= 0) {
    lines.push(
      `If things go as planned, ${inv} could grow to about ${evLabel} in one year (a gain of ${gainLabel}).`,
    );
  } else {
    lines.push(
      `If things go as planned, ${inv} could shrink to about ${evLabel} in one year (a loss of ${gainLabel}).`,
    );
  }

  // 5) One short tip
  if (metrics.advice) {
    lines.push(metrics.advice);
  } else if (er < 0 || prob >= 45) {
    lines.push("Only use money you can wait with. Do not rush.");
  } else {
    lines.push("This can fit a long-term plan if you stay patient.");
  }

  return lines.slice(0, 5);
}

function trafficLight(pct: number, question: string) {
  const color = pct >= 65 ? "green" : pct >= 40 ? "gold" : "red";
  const label = pct >= 65 ? "Good" : pct >= 40 ? "Average" : "Risky";
  return { pct, label, color, question };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ─── Price / beta fetch ───────────────────────────────────────────────────────

async function fetchDailyCloses(
  token: string | undefined,
  ticker: string,
): Promise<number[]> {
  if (token) {
    try {
      const { symbol, assetType } = toFinnhubSymbol(ticker);
      const now = Math.floor(Date.now() / 1000);
      const path = assetType === "crypto" ? "/crypto/candle" : "/stock/candle";
      const url = new URL(`${FINNHUB_BASE}${path}`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("resolution", "D");
      url.searchParams.set("from", String(now - 365 * 86400));
      url.searchParams.set("to", String(now));
      url.searchParams.set("token", token);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as { s?: string; c?: number[] };
        if (data.s === "ok" && Array.isArray(data.c)) {
          const closes = data.c.filter((p) => typeof p === "number" && p > 0);
          if (closes.length >= 10) return closes;
        }
      }
    } catch {
      /* try next source */
    }

    try {
      const chart = await fetchChart(token, ticker, "6M");
      const closes = chart.map((p) => p.close).filter((c) => c > 0);
      if (closes.length >= 10) return closes;
    } catch {
      /* try Yahoo */
    }
  }

  try {
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetch(yUrl, {
      headers: { "User-Agent": "Crowth-Worker/1.0" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        chart?: {
          result?: Array<{
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      };
      const closes =
        data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      const prices = closes.filter(
        (p): p is number => typeof p === "number" && p > 0,
      );
      if (prices.length >= 10) return prices;
    }
  } catch {
    /* empty */
  }

  return [];
}

async function fetchBeta(token: string | undefined, ticker: string): Promise<number> {
  if (!token) return 1;
  try {
    const { symbol, assetType } = toFinnhubSymbol(ticker);
    if (assetType === "crypto") return 2.1;
    const url = new URL(`${FINNHUB_BASE}/stock/metric`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("metric", "all");
    url.searchParams.set("token", token);
    const res = await fetch(url.toString());
    if (!res.ok) return 1;
    const data = (await res.json()) as { metric?: { beta?: number } };
    const beta = data.metric?.beta;
    return typeof beta === "number" && Number.isFinite(beta) ? beta : 1;
  } catch {
    return 1;
  }
}

const BOOKS_USED = [
  "Hardy (2003) Investment Guarantees — Ch. 2, 4, 5, 7",
  "Lo (2018) Derivative Pricing — Ch. 5-7",
  "Hull (2018) Options, Futures and Other Derivatives — Ch. 15",
  "Barucci & Fontana (2017) Financial Markets Theory — Ch. 5",
  "Wüthrich (2016) Market-Consistent Actuarial Valuation",
  "Boudreault & Renaud (2019) Actuarial Finance — Ch. 8",
];

export type ActuarialResult = Record<string, unknown>;

export async function buildActuarialAnalysis(
  assetId: string,
  investmentIn: number,
  horizonIn: number,
  finnhubKey?: string,
): Promise<ActuarialResult> {
  const investment = Math.max(100, investmentIn || 10000);
  const horizon = Math.max(0.1, Math.min(30, horizonIn || 1));
  let ticker: string;
  try {
    ticker = resolveTicker(assetId);
  } catch {
    ticker = assetId.toUpperCase();
  }

  try {
    const [prices, beta] = await Promise.all([
      fetchDailyCloses(finnhubKey, ticker),
      fetchBeta(finnhubKey, ticker),
    ]);

    if (prices.length < 10) {
      return {
        id: assetId.toLowerCase(),
        ticker,
        investment,
        horizon,
        score: {
          score: null,
          color: "gold",
          label: "Not enough data yet",
          summary:
            "We do not have enough price history for a full check yet. Try again later.",
          components: { risk: 0, alpha: 0, sharpe: 0, regime: 0 },
        },
        analysis: {
          growth: trafficLight(50, "Is it growing?"),
          profitability: trafficLight(50, "Does it make money?"),
          stability: trafficLight(50, "Is the price stable?"),
          competition: trafficLight(50, "Is the market good right now?"),
        },
        explanation: [
          "We do not have enough price history for a full check yet. Try again later.",
        ],
        summary: "Not enough price history for a full check yet.",
        metrics: {},
        books_used: [],
        stale: true,
        available: false,
        source: "insufficient_data",
      };
    }

    let currentPrice = prices[prices.length - 1];
    if (finnhubKey) {
      try {
        const quote = await fetchQuote(finnhubKey, ticker);
        if (quote.price != null && quote.price > 0) currentPrice = quote.price;
      } catch {
        /* keep last close */
      }
    }

    const returns = calcReturnStats(prices);
    const { mu, sigma, sharpe_ratio } = returns;
    const risk = calcVaRCTE(mu, sigma, investment, horizon);
    const multi_horizon = calcMultiHorizon(mu, sigma, investment);
    const options = calcBlackScholes(
      currentPrice,
      currentPrice,
      horizon,
      SA_REPO_RATE,
      Math.max(sigma, 0.05),
    );
    const capm = calcCAPM(mu, beta);
    const regime = detectRegime(prices);
    const score = calcScore(
      risk.var_95,
      capm.alpha_pct,
      sharpe_ratio,
      regime.regime,
      regime.confidence,
      investment,
      risk.prob_loss_pct,
      options.risk_neutral_prob_gain_pct,
    );

    const explanation = translateToEnglish(
      {
        annual_expected_return: returns.annual_expected_return,
        annual_volatility: returns.annual_volatility,
        var_95: risk.var_95,
        prob_loss_pct: risk.prob_loss_pct,
        expected_terminal_value: risk.expected_terminal_value,
        alpha_pct: capm.alpha_pct,
        description: regime.description,
        advice: regime.advice,
        risk_neutral_prob_gain_pct: options.risk_neutral_prob_gain_pct,
        downside_protection_cost_pct: options.downside_protection_cost_pct,
        sharpe_ratio,
      },
      investment,
    );

    return {
      id: assetId.toLowerCase(),
      ticker,
      investment,
      horizon,
      score,
      analysis: {
        growth: trafficLight(score.components.alpha, "Is it growing?"),
        profitability: trafficLight(
          score.components.sharpe,
          "Does it make money?",
        ),
        stability: trafficLight(score.components.risk, "Is the price stable?"),
        competition: trafficLight(
          score.components.regime,
          "Is the market good right now?",
        ),
      },
      metrics: {
        returns,
        risk,
        multi_horizon,
        options,
        capm,
        regime,
      },
      explanation,
      summary: explanation.slice(0, 3).join(" "),
      books_used: BOOKS_USED,
      stale: false,
      available: true,
      source: "live",
    };
  } catch (err) {
    return {
      id: assetId.toLowerCase(),
      ticker,
      investment,
      horizon,
      score: {
        score: null,
        color: "gold",
        label: "Analysis not available right now",
        summary:
          "We could not complete the full check. Try again shortly.",
        components: { risk: 0, alpha: 0, sharpe: 0, regime: 0 },
      },
      analysis: {
        growth: trafficLight(50, "Is it growing?"),
        profitability: trafficLight(50, "Does it make money?"),
        stability: trafficLight(50, "Is the price stable?"),
        competition: trafficLight(50, "Is the market good right now?"),
      },
      explanation: [
        "This longer-term check is not available right now. Try again shortly.",
      ],
      summary: "Longer-term check temporarily unavailable.",
      metrics: {},
      books_used: [],
      stale: true,
      available: false,
      source: "error_fallback",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
