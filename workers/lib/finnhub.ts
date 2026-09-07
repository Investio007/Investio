import { FINNHUB_PERIOD_MAP, listingCurrency, toFinnhubSymbol } from "./symbols";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export type QuoteData = {
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
};

export type ChartPoint = {
  time: string;
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number;
};

function safeFloat(val: unknown): number | null {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

async function finnhubGet(
  path: string,
  params: Record<string, string | number>,
  token: string,
): Promise<Record<string, unknown>> {
  const url = new URL(`${FINNHUB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("token", token);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub ${path} failed: ${res.status}`);
  const payload = (await res.json()) as Record<string, unknown>;
  if (payload.error) throw new Error(String(payload.error));
  return payload;
}

function timeLabel(period: string, ts: number): string {
  const d = new Date(ts * 1000);
  if (period === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  }
  if (period === "1W") {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export async function fetchQuote(token: string, ticker: string): Promise<QuoteData> {
  const { symbol, assetType } = toFinnhubSymbol(ticker);

  if (assetType === "crypto") {
    const now = Math.floor(Date.now() / 1000);
    const candles = await finnhubGet(
      "/crypto/candle",
      { symbol, resolution: "D", from: now - 7 * 86400, to: now },
      token,
    );
    if (candles.s !== "ok" || !Array.isArray(candles.c) || !(candles.c as number[]).length) {
      throw new Error(`No crypto quote for ${ticker}`);
    }
    const closes = candles.c as number[];
    const price = safeFloat(closes[closes.length - 1]);
    const prevClose = closes.length >= 2 ? safeFloat(closes[closes.length - 2]) : price;
    const change =
      price != null && prevClose != null ? Math.round((price - prevClose) * 100) / 100 : null;
    const changePercent =
      change != null && prevClose ? Math.round((change / prevClose) * 10000) / 100 : null;
    return {
      ticker,
      name: "Bitcoin",
      price,
      prevClose,
      change,
      changePercent,
      changePositive: (changePercent ?? 0) >= 0,
      high: Array.isArray(candles.h) ? safeFloat((candles.h as number[])[closes.length - 1]) : null,
      low: Array.isArray(candles.l) ? safeFloat((candles.l as number[])[closes.length - 1]) : null,
      volume: Array.isArray(candles.v) ? Math.round((candles.v as number[])[closes.length - 1] ?? 0) : null,
      marketCap: null,
      currency: "USD",
    };
  }

  const quote = await finnhubGet("/quote", { symbol }, token);
  const price = safeFloat(quote.c);
  // Finnhub returns c:0 for unsupported symbols — treat as missing
  if (price == null || price <= 0) throw new Error(`No quote for ${ticker}`);

  let name = symbol;
  let profileCurrency: string | null = null;
  try {
    const profile = await finnhubGet("/stock/profile2", { symbol }, token);
    name = String(profile.name || profile.ticker || symbol);
    profileCurrency = profile.currency != null ? String(profile.currency) : null;
  } catch {
    /* profile optional */
  }

  const currency = listingCurrency(ticker, profileCurrency);

  const prevClose = safeFloat(quote.pc);
  const change = safeFloat(quote.d) ?? (prevClose != null ? Math.round((price - prevClose) * 100) / 100 : null);
  const changePercent =
    safeFloat(quote.dp) ??
    (change != null && prevClose ? Math.round((change / prevClose) * 10000) / 100 : null);

  return {
    ticker,
    name,
    price,
    prevClose,
    change,
    changePercent,
    changePositive: (changePercent ?? 0) >= 0,
    high: safeFloat(quote.h),
    low: safeFloat(quote.l),
    volume: null,
    marketCap: null,
    currency,
  };
}

/** Quote-only fetch for bulk insights (skips profile2 to avoid Finnhub rate limits). */
export async function fetchQuoteLight(token: string, ticker: string): Promise<QuoteData> {
  const { symbol, assetType } = toFinnhubSymbol(ticker);

  if (assetType === "crypto") {
    return fetchQuote(token, ticker);
  }

  const quote = await finnhubGet("/quote", { symbol }, token);
  const price = safeFloat(quote.c);
  if (price == null || price <= 0) throw new Error(`No quote for ${ticker}`);

  const prevClose = safeFloat(quote.pc);
  const change =
    safeFloat(quote.d) ??
    (prevClose != null ? Math.round((price - prevClose) * 100) / 100 : null);
  const changePercent =
    safeFloat(quote.dp) ??
    (change != null && prevClose ? Math.round((change / prevClose) * 10000) / 100 : null);
  if (changePercent == null) throw new Error(`No change for ${ticker}`);

  return {
    ticker,
    name: symbol,
    price,
    prevClose,
    change,
    changePercent,
    changePositive: changePercent >= 0,
    high: safeFloat(quote.h),
    low: safeFloat(quote.l),
    volume: null,
    marketCap: null,
    currency: listingCurrency(ticker, null),
  };
}

export async function fetchChart(
  token: string,
  ticker: string,
  period: string,
): Promise<ChartPoint[]> {
  const { symbol, assetType } = toFinnhubSymbol(ticker);
  const { resolution, lookbackSec } = FINNHUB_PERIOD_MAP[period] ?? FINNHUB_PERIOD_MAP["1W"];
  const now = Math.floor(Date.now() / 1000);
  const path = assetType === "crypto" ? "/crypto/candle" : "/stock/candle";
  const candles = await finnhubGet(
    path,
    { symbol, resolution, from: now - lookbackSec, to: now },
    token,
  );
  if (candles.s !== "ok") throw new Error(`No chart for ${ticker}/${period}`);

  const timestamps = (candles.t as number[]) || [];
  const opens = (candles.o as number[]) || [];
  const highs = (candles.h as number[]) || [];
  const lows = (candles.l as number[]) || [];
  const closes = (candles.c as number[]) || [];
  const volumes = (candles.v as number[]) || [];

  const data: ChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = safeFloat(closes[i]);
    if (close == null) continue;
    const ts = timestamps[i];
    data.push({
      time: timeLabel(period, ts),
      timestamp: new Date(ts * 1000).toISOString(),
      open: safeFloat(opens[i]),
      high: safeFloat(highs[i]),
      low: safeFloat(lows[i]),
      close,
      volume: Math.round(volumes[i] ?? 0),
    });
  }
  return data;
}

export function emptyQuote(ticker: string): QuoteData {
  return {
    ticker,
    name: ticker,
    price: null,
    prevClose: null,
    change: null,
    changePercent: null,
    changePositive: true,
    high: null,
    low: null,
    volume: null,
    marketCap: null,
    currency: "USD",
  };
}
