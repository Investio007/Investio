import { useEffect, useState } from "react";
import {
  ChartData,
  Period,
  QuoteData,
  marketApi,
  normalizeCompareCompany,
  type CompareCompany,
  type CompareVerdict,
  type MarketInsight,
  type MarketSnapshot,
} from "../services/marketApi";
import { companies as staticCompanies } from "../data/assets";

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<string, { data: MarketSnapshot; at: number }>();

function snapshotKey(symbol: string, period: Period) {
  return `${symbol}:${period}`;
}

function readSnapshotCache(symbol: string, period: Period): MarketSnapshot | null {
  const entry = snapshotCache.get(snapshotKey(symbol, period));
  if (!entry) return null;
  if (Date.now() - entry.at > SNAPSHOT_CACHE_TTL_MS) return null;
  return entry.data;
}

function writeSnapshotCache(symbol: string, period: Period, data: MarketSnapshot) {
  snapshotCache.set(snapshotKey(symbol, period), { data, at: Date.now() });
}

export function useMarketSnapshot(symbol: string, period: Period = "1D") {
  const cached = symbol ? readSnapshotCache(symbol, period) : null;
  const [quote, setQuote] = useState<QuoteData | null>(cached?.quote ?? null);
  const [chart, setChart] = useState<ChartData | null>(cached?.chart ?? null);
  const [chartSource, setChartSource] = useState(cached?.chartSource ?? "");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      setChart(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cachedNow = readSnapshotCache(symbol, period);

    if (cachedNow) {
      setQuote(cachedNow.quote);
      setChart(cachedNow.chart);
      setChartSource(cachedNow.chartSource);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(false);
      setQuote(null);
      setChart(null);
    }

    setError(null);

    marketApi
      .getSnapshot(symbol, period)
      .then((snapshot) => {
        if (cancelled || snapshot.quote.id !== symbol) return;
        writeSnapshotCache(symbol, period, snapshot);
        setQuote(snapshot.quote);
        setChart(snapshot.chart);
        setChartSource(snapshot.chartSource);
      })
      .catch((errorValue) => {
        if (!cancelled) {
          setError(errorValue instanceof Error ? errorValue.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period, symbol]);

  return { quote, chart, chartSource, loading, refreshing, error };
}

export function useQuote(symbol: string) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const quote = await marketApi.getQuote(symbol);
        if (!cancelled && quote.id === symbol) {
          setData(quote);
        }
      } catch (errorValue) {
        if (!cancelled) {
          setError(
            errorValue instanceof Error ? errorValue.message : "Unknown error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, loading, error };
}

export function useChart(symbol: string, period: Period = "1W") {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const chart = await marketApi.getChart(symbol, period);
        if (!cancelled) {
          setData(chart);
        }
      } catch (errorValue) {
        if (!cancelled) {
          setError(
            errorValue instanceof Error ? errorValue.message : "Unknown error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [period, symbol]);

  return { data, loading, error };
}

export function useInsights() {
  const [data, setData] = useState<MarketInsight[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await marketApi.getInsights();
        if (!cancelled) {
          setData(response.assets);
          setUpdatedAt(response.updatedAt);
          setError(null);
        }
      } catch (errorValue) {
        if (!cancelled) {
          setError(
            errorValue instanceof Error ? errorValue.message : "Unknown error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, updatedAt, loading, error };
}

export function useCompare() {
  const [companies, setCompanies] = useState<CompareCompany[]>([]);
  const [verdict, setVerdict] = useState<CompareVerdict | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await marketApi.getCompare();
        if (cancelled) return;

        const normalized = response.companies.map((company) => {
          const fallback = staticCompanies.find((item) => item.id === company.id);
          return normalizeCompareCompany(company, fallback
            ? {
                name: fallback.name,
                ticker: fallback.ticker,
                aiScore: fallback.aiScore,
                description: fallback.description,
                explanation: fallback.explanation,
                analysis: {
                  growth: {
                    pct: fallback.analysis.growth.pct,
                    label: fallback.analysis.growth.label,
                    color: fallback.analysis.growth.color,
                  },
                  profitability: {
                    pct: fallback.analysis.profitability.pct,
                    label: fallback.analysis.profitability.label,
                    color: fallback.analysis.profitability.color,
                  },
                  stability: {
                    pct: fallback.analysis.stability.pct,
                    label: fallback.analysis.stability.label,
                    color: fallback.analysis.stability.color,
                  },
                  competition: {
                    pct: fallback.analysis.competition.pct,
                    label: fallback.analysis.competition.label,
                    color: fallback.analysis.competition.color,
                  },
                },
              }
            : undefined);
        });

        // Client-side verdict when API omits it (legacy backend response).
        let verdict = response.verdict ?? null;
        if (!verdict && normalized.length > 0) {
          const winner = [...normalized].sort(
            (a, b) => b.longTermScore - a.longTermScore,
          )[0];
          normalized.forEach((company) => {
            company.isWinner = company.id === winner.id;
          });
          verdict = {
            winnerId: winner.id,
            headline: `${winner.name} is the best long-term pick here`,
            summary: `${winner.name} scores highest on growth, profit, and stability combined — a solid choice for holding long term.`,
            tips: [
              "Think in years, not days — short dips are normal.",
              "Don't put all your money in one company; spread across 2–3 strong picks.",
              "Scores refresh with live data — check back monthly.",
            ],
          };
        }

        setCompanies(normalized);
        setVerdict(verdict);
        setUpdatedAt(response.updatedAt ?? new Date().toISOString());
        setStale(response.stale || response.compareVersion !== 2);
        setError(null);
      } catch (errorValue) {
        if (!cancelled) {
          setError(
            errorValue instanceof Error ? errorValue.message : "Unknown error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { companies, verdict, updatedAt, stale, loading, error };
}

export function usePortfolioQuotes(assetIds: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(assetIds.length > 0);
  const [error, setError] = useState<string | null>(null);

  const idsKey = assetIds.slice().sort().join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];

    if (ids.length === 0) {
      setQuotes({});
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled(
        ids.map((id) => marketApi.getQuote(id)),
      );

      if (cancelled) return;

      const next: Record<string, QuoteData> = {};
      let failures = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          next[ids[index]] = result.value;
        } else {
          failures++;
        }
      });

      setQuotes(next);
      setError(
        failures === ids.length
          ? "Live prices unavailable. Check that the market API is running."
          : null,
      );
      setLoading(false);
    };

    void load();
    const interval = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [idsKey]);

  return { quotes, loading, error };
}
