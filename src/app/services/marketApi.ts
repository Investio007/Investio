const BASE_URL = import.meta.env.VITE_MARKET_API_URL || "";

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
  getCompare: () => apiFetch<{ companies: Partial<QuoteData>[] }>("/api/compare"),
  getInsights: () => apiFetch<{ assets: Partial<QuoteData>[] }>("/api/insights"),
  health: () => apiFetch<{ status: string }>("/api/health"),
};
