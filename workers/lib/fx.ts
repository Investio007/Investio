import { cacheGet, cacheGetStale, cacheSet } from "./cache";

export type FxRates = {
  base: "USD";
  /** Units of currency per 1 USD (e.g. ZAR ≈ 18.5) */
  rates: Record<string, number>;
  source: string;
  updatedAt: string;
};

const FX_TTL_SEC = 3600;
const FX_CACHE_KEY = "fx:usd:v1";

/** Soft fallback if live FX is unavailable (approx mid-2020s USDZAR). */
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  ZAR: 18.5,
  EUR: 0.92,
  GBP: 0.79,
  HKD: 7.8,
  KRW: 1350,
  CNY: 7.2,
  JPY: 150,
  CAD: 1.36,
  AUD: 1.52,
};

async function fetchFrankfurterUsd(): Promise<FxRates | null> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD");
    if (!res.ok) return null;
    const body = (await res.json()) as { rates?: Record<string, number>; date?: string };
    if (!body.rates || typeof body.rates.ZAR !== "number") return null;
    return {
      base: "USD",
      rates: { USD: 1, ...body.rates },
      source: "frankfurter",
      updatedAt: body.date ? `${body.date}T00:00:00.000Z` : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFinnhubUsd(token: string): Promise<FxRates | null> {
  try {
    const url = new URL("https://finnhub.io/api/v1/forex/rates");
    url.searchParams.set("base", "USD");
    url.searchParams.set("token", token);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const body = (await res.json()) as { base?: string; quote?: Record<string, number> };
    const quote = body.quote;
    if (!quote || typeof quote.ZAR !== "number") return null;
    return {
      base: "USD",
      rates: { USD: 1, ...quote },
      source: "finnhub",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getUsdFxRates(finnhubToken?: string): Promise<FxRates> {
  const hit = cacheGet<FxRates>(FX_CACHE_KEY, FX_TTL_SEC);
  if (hit.fresh && hit.data) return hit.data;

  let live: FxRates | null = null;
  if (finnhubToken) live = await fetchFinnhubUsd(finnhubToken);
  if (!live) live = await fetchFrankfurterUsd();

  if (live) {
    cacheSet(FX_CACHE_KEY, live, FX_TTL_SEC);
    return live;
  }

  const stale = cacheGetStale<FxRates>(FX_CACHE_KEY);
  if (stale) return { ...stale, source: `${stale.source}_stale` };

  return {
    base: "USD",
    rates: { ...FALLBACK_RATES },
    source: "fallback",
    updatedAt: new Date().toISOString(),
  };
}

/** Convert an amount in `fromCurrency` into ZAR using USD-based rates. */
export function toZar(
  amount: number | null | undefined,
  fromCurrency: string | null | undefined,
  fx: FxRates,
): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const code = (fromCurrency || "USD").toUpperCase().trim();
  if (code === "ZAR") return Math.round(amount * 100) / 100;

  const zarPerUsd = fx.rates.ZAR;
  if (!zarPerUsd || !Number.isFinite(zarPerUsd)) return null;

  if (code === "USD") return Math.round(amount * zarPerUsd * 100) / 100;

  const unitsPerUsd = fx.rates[code];
  if (!unitsPerUsd || !Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) {
    // Unknown currency — assume USD-quoted to avoid blank UI
    return Math.round(amount * zarPerUsd * 100) / 100;
  }

  const inUsd = amount / unitsPerUsd;
  return Math.round(inUsd * zarPerUsd * 100) / 100;
}

export function zarPerUnit(fromCurrency: string | null | undefined, fx: FxRates): number | null {
  const code = (fromCurrency || "USD").toUpperCase().trim();
  if (code === "ZAR") return 1;
  const zarPerUsd = fx.rates.ZAR;
  if (!zarPerUsd || !Number.isFinite(zarPerUsd)) return null;
  if (code === "USD") return zarPerUsd;
  const unitsPerUsd = fx.rates[code];
  if (!unitsPerUsd || unitsPerUsd <= 0) return zarPerUsd;
  return zarPerUsd / unitsPerUsd;
}
