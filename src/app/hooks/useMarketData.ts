import { useCallback, useEffect, useState } from "react";
import {
  ChartData,
  Period,
  QuoteData,
  marketApi,
} from "../services/marketApi";

export function useQuote(symbol: string) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const quote = await marketApi.getQuote(symbol);
      setData(quote);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchQuote();
    const interval = setInterval(fetchQuote, 60_000);
    return () => clearInterval(interval);
  }, [fetchQuote]);

  return { data, loading, error, refresh: fetchQuote };
}

export function useChart(symbol: string, period: Period = "1W") {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChart = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const chart = await marketApi.getChart(symbol, period);
      setData(chart);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period, symbol]);

  useEffect(() => {
    fetchChart();
    const interval = setInterval(fetchChart, 60_000);
    return () => clearInterval(interval);
  }, [fetchChart]);

  return { data, loading, error, refresh: fetchChart };
}

type LiveQuote = Partial<QuoteData> & { id: string };

export function useInsights() {
  const [data, setData] = useState<LiveQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketApi
      .getInsights()
      .then((response) => {
        if (!cancelled) setData(response.assets as LiveQuote[]);
      })
      .catch((errorValue) => {
        if (!cancelled) {
          setError(errorValue instanceof Error ? errorValue.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = setInterval(() => {
      marketApi
        .getInsights()
        .then((response) => {
          if (!cancelled) setData(response.assets as LiveQuote[]);
        })
        .catch(() => {});
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}

export function useCompare() {
  const [data, setData] = useState<LiveQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketApi
      .getCompare()
      .then((response) => {
        if (!cancelled) setData(response.companies as LiveQuote[]);
      })
      .catch((errorValue) => {
        if (!cancelled) {
          setError(errorValue instanceof Error ? errorValue.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
