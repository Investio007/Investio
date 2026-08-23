/** Heuristic sentiment / traffic-light scores (mirrors FastAPI static fundamentals path). */

type Fundamentals = { revenue_growth: number; profit_margin: number; beta: number };
type MetricColor = "green" | "gold" | "red";

const STATIC_FUNDAMENTALS: Record<string, Fundamentals> = {
  aitech: { revenue_growth: 0.12, profit_margin: 0.22, beta: 1.15 },
  energy: { revenue_growth: 0.04, profit_margin: 0.18, beta: 0.95 },
  crypto: { revenue_growth: 0.25, profit_margin: 0.05, beta: 2.1 },
  apple: { revenue_growth: 0.08, profit_margin: 0.26, beta: 1.2 },
  microsoft: { revenue_growth: 0.14, profit_margin: 0.36, beta: 0.9 },
  alphabet: { revenue_growth: 0.1, profit_margin: 0.24, beta: 1.05 },
  tesla: { revenue_growth: 0.18, profit_margin: 0.12, beta: 1.85 },
  amazon: { revenue_growth: 0.11, profit_margin: 0.08, beta: 1.25 },
  nvidia: { revenue_growth: 0.55, profit_margin: 0.48, beta: 1.7 },
  meta: { revenue_growth: 0.16, profit_margin: 0.3, beta: 1.3 },
  netflix: { revenue_growth: 0.09, profit_margin: 0.16, beta: 1.4 },
};

const DEFAULT_FUNDAMENTALS: Fundamentals = {
  revenue_growth: 0.06,
  profit_margin: 0.15,
  beta: 1.1,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function scoreLabel(score: number): { label: string; color: MetricColor } {
  if (score >= 65) return { label: "Good", color: "green" };
  if (score >= 40) return { label: "Average", color: "gold" };
  return { label: "Risky", color: "red" };
}

function ratingLabel(score: number): string {
  if (score >= 70) return "Looks Good to Invest";
  if (score >= 55) return "Could Be Worth It";
  if (score >= 40) return "Be Careful With This One";
  return "Too Risky Right Now";
}

function plainExplanation(
  growth: number,
  profit: number,
  stability: number,
  competition: number,
): string {
  const parts: string[] = [];
  if (growth >= 65) parts.push("This company is growing fast");
  else if (growth >= 40) parts.push("This company is growing slowly");
  else parts.push("This company is not growing much right now");

  if (profit >= 65) parts.push("it makes good money");
  else if (profit >= 40) parts.push("it makes some money");
  else parts.push("it is not making much profit");

  if (stability < 40) parts.push("but the price goes up and down a lot");
  else if (stability >= 65) parts.push("and the price is quite stable");

  if (competition < 40) parts.push("The news about this company is not great right now");
  else if (competition >= 65) parts.push("The news about this company is mostly positive");

  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(". ") + ".";
}

export function buildSentiment(assetId: string, ticker: string) {
  const fundamentals = STATIC_FUNDAMENTALS[assetId.toLowerCase()] ?? DEFAULT_FUNDAMENTALS;
  // Deterministic pseudo news score when no NewsAPI key on Workers
  const newsSentimentScore = 45 + (hashString(assetId) % 30);

  const growthScore = clamp(40 + fundamentals.revenue_growth * 250);
  const profitScore = clamp(fundamentals.profit_margin * 280);
  const stabilityScore = clamp(100 - Math.max(0, fundamentals.beta - 0.8) * 35);
  const competitionScore = clamp(newsSentimentScore);

  const aiScore = Math.round(
    growthScore * 0.3 + profitScore * 0.25 + stabilityScore * 0.2 + competitionScore * 0.25,
  );

  const g = scoreLabel(growthScore);
  const p = scoreLabel(profitScore);
  const s = scoreLabel(stabilityScore);
  const c = scoreLabel(competitionScore);

  return {
    id: assetId,
    ticker,
    aiScore,
    rating: ratingLabel(aiScore),
    explanation: plainExplanation(growthScore, profitScore, stabilityScore, competitionScore),
    analysis: {
      growth: { pct: Math.round(growthScore), label: g.label, color: g.color },
      profitability: { pct: Math.round(profitScore), label: p.label, color: p.color },
      stability: { pct: Math.round(stabilityScore), label: s.label, color: s.color },
      competition: { pct: Math.round(competitionScore), label: c.label, color: c.color },
    },
    newsSentimentScore: Math.round(newsSentimentScore * 10) / 10,
    sources: { fundamentals: "static", sentiment: "static" },
  };
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

export function longTermScoreFromAnalysis(analysis: {
  growth: { pct: number };
  profitability: { pct: number };
  stability: { pct: number };
  competition: { pct: number };
}): number {
  return Math.round(
    analysis.growth.pct * 0.25 +
      analysis.profitability.pct * 0.3 +
      analysis.stability.pct * 0.35 +
      analysis.competition.pct * 0.1,
  );
}
