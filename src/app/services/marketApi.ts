const BASE_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_MARKET_API_URL || "");

export interface QuoteData {
  id: string;
  ticker: string;
  name: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  changePositive: boolean;
  high: number | null;
  low: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string;
}

export interface ChartPoint {
  time: string;
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number;
}

export interface ChartData {
  symbol: string;
  period: string;
  data: ChartPoint[];
  count: number;
}

export type Period = "1D" | "1W" | "1M" | "6M" | "1Y";

export type MarketSnapshot = {
  quote: QuoteData;
  chart: ChartData;
  chartSource: "live" | "cache" | "synthetic" | "stale_cache" | string;
};

export type MarketInsight = {
  id: string;
  rank: number;
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  changePositive: boolean;
  currency: string;
  aiScore: number;
  aiPrediction: string;
  rating: string;
  ratingColor: "green" | "gold" | "red";
};

export type InsightsResponse = {
  assets: MarketInsight[];
  count: number;
  updatedAt: string;
  stale: boolean;
  source: string;
};

export type CompareMetric = {
  pct: number;
  label: string;
  color: "green" | "gold" | "red";
};

export type CompareCompany = {
  id: string;
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  changePositive: boolean;
  currency: string;
  aiScore: number;
  rating: string;
  explanation: string;
  longTermScore: number;
  isWinner: boolean;
  badges: string[];
  analysis: {
    growth: CompareMetric;
    profitability: CompareMetric;
    stability: CompareMetric;
    competition: CompareMetric;
  };
};

export type CompareVerdict = {
  winnerId: string;
  headline: string;
  summary: string;
  tips: string[];
};

export type CompareResponse = {
  companies: CompareCompany[];
  verdict?: CompareVerdict | null;
  badges?: Record<string, string>;
  updatedAt?: string;
  stale: boolean;
  source: string;
  compareVersion?: number;
};

const DEFAULT_COMPARE_METRIC: CompareMetric = {
  pct: 50,
  label: "Average",
  color: "gold",
};

function longTermScoreFromAnalysis(
  analysis: CompareCompany["analysis"],
): number {
  return Math.round(
    analysis.growth.pct * 0.25 +
      analysis.profitability.pct * 0.3 +
      analysis.stability.pct * 0.35 +
      analysis.competition.pct * 0.1,
  );
}

/** Fill gaps when the API returns quote-only rows (legacy cache / old backend). */
export function normalizeCompareCompany(
  raw: Partial<CompareCompany> & { id: string },
  fallback?: {
    name: string;
    ticker: string;
    aiScore: number;
    description: string;
    explanation: string;
    analysis: CompareCompany["analysis"];
  },
): CompareCompany {
  const analysis: CompareCompany["analysis"] = {
    growth: raw.analysis?.growth ?? fallback?.analysis.growth ?? DEFAULT_COMPARE_METRIC,
    profitability:
      raw.analysis?.profitability ??
      fallback?.analysis.profitability ??
      DEFAULT_COMPARE_METRIC,
    stability:
      raw.analysis?.stability ??
      fallback?.analysis.stability ??
      DEFAULT_COMPARE_METRIC,
    competition:
      raw.analysis?.competition ??
      fallback?.analysis.competition ??
      DEFAULT_COMPARE_METRIC,
  };

  const aiScore = raw.aiScore ?? fallback?.aiScore ?? 50;
  const longTermScore =
    raw.longTermScore ?? longTermScoreFromAnalysis(analysis);

  return {
    id: raw.id,
    ticker: raw.ticker ?? fallback?.ticker ?? raw.id.toUpperCase(),
    name: raw.name ?? fallback?.name ?? raw.id,
    price: raw.price ?? null,
    change: raw.change ?? null,
    changePercent: raw.changePercent ?? null,
    changePositive: raw.changePositive ?? (raw.changePercent ?? 0) >= 0,
    currency: raw.currency ?? "USD",
    aiScore,
    rating: raw.rating ?? "Could Be Worth It",
    explanation: raw.explanation ?? fallback?.explanation ?? fallback?.description ?? "",
    longTermScore,
    isWinner: raw.isWinner ?? false,
    badges: raw.badges ?? [],
    analysis,
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: "Unknown error" })) as { detail?: string };
    throw new Error(errorBody.detail || `API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const marketApi = {
  getQuote: (symbol: string) => apiFetch<QuoteData>(`/api/quote/${symbol}`),
  getChart: (symbol: string, period: Period) =>
    apiFetch<ChartData>(`/api/chart/${symbol}/${period}`),
  getSnapshot: (symbol: string, period: Period) =>
    apiFetch<MarketSnapshot>(`/api/snapshot/${symbol}/${period}`),
  getCompare: () => apiFetch<CompareResponse>("/api/compare"),
  getInsights: () => apiFetch<InsightsResponse>("/api/insights"),
  health: () => apiFetch<{ status: string }>("/api/health"),
};
