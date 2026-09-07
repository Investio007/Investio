/**
 * Cloudflare Worker: Crowth SPA assets + native /api (Finnhub + Workers AI).
 * Replaces the Railway FastAPI proxy for production on Cloudflare.
 */

import { cacheGet, cacheGetStale, cacheSet } from "./lib/cache";
import { chatWithWorkersAi, type AiBinding } from "./lib/ai";
import { emptyQuote, fetchChart, fetchQuote, fetchQuoteLight, type ChartPoint, type QuoteData } from "./lib/finnhub";
import { buildActuarialAnalysis } from "./lib/actuarial";
import { getUsdFxRates, toZar, zarPerUnit, type FxRates } from "./lib/fx";
import {
  ASSET_DISPLAY_NAMES,
  COMPARE_ASSET_IDS,
  FINNHUB_PERIOD_MAP,
  INSIGHT_ASSET_IDS,
  listingCurrency,
  resolveTicker,
} from "./lib/symbols";
import { buildSentiment, longTermScoreFromAnalysis } from "./lib/sentiment";

export interface Env {
  ASSETS: Fetcher;
  AI?: AiBinding;
  FINNHUB_API_KEY?: string;
  /** Public Supabase project URL — injected into HTML for the SPA */
  SUPABASE_URL?: string;
  /** Public anon key — injected into HTML for the SPA */
  SUPABASE_ANON_KEY?: string;
  /** Public Google Web client ID — GIS sign-in on the app origin */
  GOOGLE_WEB_CLIENT_ID?: string;
  /** Service role for account deletion (never expose to the client) */
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

type ZarMoneyMeta = {
  currencyNative: string;
  priceNative: number | null;
  fxRateToZar: number | null;
  fxSource: string;
};

function quoteToZar(quote: QuoteData, fx: FxRates): QuoteData & ZarMoneyMeta {
  const native = (quote.currency || "USD").toUpperCase();
  const rate = zarPerUnit(native, fx);
  return {
    ...quote,
    priceNative: quote.price,
    currencyNative: native,
    fxRateToZar: rate,
    fxSource: fx.source,
    price: toZar(quote.price, native, fx),
    prevClose: toZar(quote.prevClose, native, fx),
    change: toZar(quote.change, native, fx),
    high: toZar(quote.high, native, fx),
    low: toZar(quote.low, native, fx),
    currency: "ZAR",
  };
}

function chartToZar(
  points: ChartPoint[],
  fromCurrency: string,
  fx: FxRates,
): ChartPoint[] {
  const rate = zarPerUnit(fromCurrency, fx);
  if (rate == null || Math.abs(rate - 1) < 1e-9) return points;
  return points.map((p) => ({
    ...p,
    open: p.open != null ? Math.round(p.open * rate * 100) / 100 : null,
    high: p.high != null ? Math.round(p.high * rate * 100) / 100 : null,
    low: p.low != null ? Math.round(p.low * rate * 100) / 100 : null,
    close: Math.round(p.close * rate * 100) / 100,
  }));
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  // Explicitly disable legacy XSS auditor; CSP is the modern control.
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Isolation without COEP (COEP would break Google GIS / third-party scripts).
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** CSP for SPA + Google GIS + Supabase + PostHog/Sentry (bundled SDKs). */
function buildContentSecurityPolicy(nonce?: string): string {
  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    "https://accounts.google.com",
    "https://apis.google.com",
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com",
      "https://us.i.posthog.com",
      "https://*.posthog.com",
      "https://*.sentry.io",
      "https://*.ingest.sentry.io",
      "https://finnhub.io",
    ].join(" "),
    "frame-src https://accounts.google.com https://*.google.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const TTL = { quote: 60, chart: 300, compare: 60, insights: 60, sentiment: 300, actuarial: 120 };
const INSIGHT_TOP_N = 20;

const COMPARE_BADGE_LABELS: Record<string, string> = {
  growth: "Best growth",
  profitability: "Most profitable",
  stability: "Most stable",
};

function withSecurityHeaders(
  response: Response,
  options?: { nonce?: string; html?: boolean },
): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(options?.nonce),
  );
  if (options?.html) {
    // Auth SPA HTML must not be cached by shared caches / BFCache scrapers.
    headers.set("Cache-Control", "no-store, private");
  }
  // Cloudflare re-adds Server at the edge; deleting here has no lasting effect.
  headers.delete("X-Powered-By");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }),
  );
}

function requireToken(env: Env): string {
  const token = (env.FINNHUB_API_KEY || "").trim();
  if (!token) throw new Error("FINNHUB_API_KEY not configured");
  return token;
}

function syntheticChart(quote: QuoteData, period: string): ChartPoint[] {
  const price = quote.price ?? 100;
  const changePct = (quote.changePercent ?? 0) / 100;
  const points = period === "1D" ? 24 : period === "1W" ? 14 : period === "1M" ? 22 : period === "6M" ? 26 : 52;
  const now = Date.now();
  const stepMs =
    period === "1D"
      ? 3600_000
      : period === "1W"
        ? 12 * 3600_000
        : period === "1M"
          ? 86400_000
          : period === "6M"
            ? 7 * 86400_000
            : 7 * 86400_000;

  const start = price / (1 + changePct || 1);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i + 1) / points;
    const close = Math.round((start + (price - start) * t) * 100) / 100;
    const ts = new Date(now - (points - i) * stepMs);
    out.push({
      time: ts.toISOString().slice(5, 16).replace("T", " "),
      timestamp: ts.toISOString(),
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
    });
  }
  return out;
}

async function handleQuote(env: Env, symbolParam: string): Promise<Response> {
  let ticker: string;
  try {
    ticker = resolveTicker(symbolParam);
  } catch {
    return json({ detail: "Invalid or unsupported symbol", available: false }, 400);
  }

  const cacheKey = `quote:${ticker}`;
  const { data: cached, fresh } = cacheGet<QuoteData>(cacheKey, TTL.quote);
  const token = (env.FINNHUB_API_KEY || "").trim();
  const fx = await getUsdFxRates(token);

  if (fresh && cached && (cached.price ?? 0) > 0) {
    return json({
      ...quoteToZar(cached, fx),
      id: symbolParam,
      stale: false,
      source: "cache",
      available: true,
    });
  }

  try {
    const liveToken = requireToken(env);
    const data = await fetchQuote(liveToken, ticker);
    cacheSet(cacheKey, data, TTL.quote);
    return json({
      ...quoteToZar(data, fx),
      id: symbolParam,
      stale: false,
      source: "live",
      available: true,
    });
  } catch {
    const stale = cacheGetStale<QuoteData>(cacheKey);
    if (stale && (stale.price ?? 0) > 0) {
      return json({
        ...quoteToZar(stale, fx),
        id: symbolParam,
        stale: true,
        source: "stale_cache",
        available: true,
      });
    }
    return json(
      {
        detail: "Live price unavailable for this symbol right now.",
        id: symbolParam,
        ticker,
        available: false,
        stale: true,
        source: "unavailable",
        currency: "ZAR",
        price: null,
      },
      503,
    );
  }
}

async function handleChart(env: Env, symbolParam: string, period: string): Promise<Response> {
  if (!FINNHUB_PERIOD_MAP[period]) {
    return json({ detail: "Invalid period. Use 1D, 1W, 1M, 6M, or 1Y" }, 400);
  }

  let ticker: string;
  try {
    ticker = resolveTicker(symbolParam);
  } catch {
    return json({ detail: "Invalid or unsupported symbol" }, 400);
  }

  const cacheKey = `chart:${ticker}:${period}`;
  const token = (env.FINNHUB_API_KEY || "").trim();
  const fx = await getUsdFxRates(token);

  // Infer listing currency from a cached quote when possible
  const qHit = cacheGet<QuoteData>(`quote:${ticker}`, TTL.quote);
  const listing =
    qHit.data?.currency ||
    listingCurrency(ticker, null);

  const { data: cached, fresh } = cacheGet<ChartPoint[]>(cacheKey, TTL.chart);
  if (fresh && cached?.length) {
    const data = chartToZar(cached, listing, fx);
    return json({
      symbol: symbolParam,
      period,
      data,
      count: data.length,
      currency: "ZAR",
      currencyNative: listing,
      stale: false,
      source: "cache",
    });
  }

  try {
    const liveToken = requireToken(env);
    const native = await fetchChart(liveToken, ticker, period);
    if (!native.length) throw new Error(`Empty chart for ${ticker}/${period}`);
    cacheSet(cacheKey, native, TTL.chart);
    const data = chartToZar(native, listing, fx);
    return json({
      symbol: symbolParam,
      period,
      data,
      count: data.length,
      currency: "ZAR",
      currencyNative: listing,
      stale: false,
      source: "live",
      available: true,
    });
  } catch {
    const stale = cacheGetStale<ChartPoint[]>(cacheKey);
    if (stale?.length) {
      const data = chartToZar(stale, listing, fx);
      return json({
        symbol: symbolParam,
        period,
        data,
        count: data.length,
        currency: "ZAR",
        currencyNative: listing,
        stale: true,
        source: "stale_cache",
        available: true,
      });
    }

    // Fall back to a simple trend from the live/cached quote so charts are never blank
    let quoteForSynth: QuoteData | null =
      (qHit.data && (qHit.data.price ?? 0) > 0 ? qHit.data : null) ??
      cacheGetStale<QuoteData>(`quote:${ticker}`);
    if ((!quoteForSynth || (quoteForSynth.price ?? 0) <= 0) && token) {
      try {
        quoteForSynth = await fetchQuoteLight(token, ticker);
        cacheSet(`quote:${ticker}`, quoteForSynth, TTL.quote);
      } catch {
        quoteForSynth = null;
      }
    }

    if (quoteForSynth && (quoteForSynth.price ?? 0) > 0) {
      const zarQuote = quoteToZar(quoteForSynth, fx);
      const data = syntheticChart(zarQuote, period);
      return json({
        symbol: symbolParam,
        period,
        data,
        count: data.length,
        currency: "ZAR",
        currencyNative: listingCurrency(ticker, quoteForSynth.currency),
        stale: true,
        source: "synthetic",
        available: true,
      });
    }

    return json(
      {
        detail: "Chart data unavailable for this symbol right now.",
        symbol: symbolParam,
        period,
        data: [],
        count: 0,
        currency: "ZAR",
        currencyNative: listing,
        stale: true,
        source: "unavailable",
        available: false,
      },
      503,
    );
  }
}

async function handleSnapshot(env: Env, symbolParam: string, period: string): Promise<Response> {
  if (!FINNHUB_PERIOD_MAP[period]) period = "1W";

  let ticker: string;
  try {
    ticker = resolveTicker(symbolParam);
  } catch {
    return json({ detail: "Invalid or unsupported symbol" }, 400);
  }

  const quoteKey = `quote:${ticker}`;
  const chartKey = `chart:${ticker}:${period}`;
  const token = (env.FINNHUB_API_KEY || "").trim();
  const fx = await getUsdFxRates(token);

  let nativeQuote: QuoteData;
  let quoteSource = "unavailable";
  let quoteStale = true;
  const qCached = cacheGet<QuoteData>(quoteKey, TTL.quote);
  if (qCached.fresh && qCached.data) {
    nativeQuote = qCached.data;
    quoteSource = "cache";
    quoteStale = false;
  } else {
    try {
      const liveToken = requireToken(env);
      const live = await fetchQuote(liveToken, ticker);
      cacheSet(quoteKey, live, TTL.quote);
      nativeQuote = live;
      quoteSource = "live";
      quoteStale = false;
    } catch {
      const stale = cacheGetStale<QuoteData>(quoteKey);
      nativeQuote = stale ?? emptyQuote(ticker);
      quoteSource = stale ? "stale_cache" : "unavailable";
      quoteStale = true;
    }
  }

  const quotePayload = {
    ...quoteToZar(nativeQuote, fx),
    id: symbolParam,
    stale: quoteStale,
    source: quoteSource,
    available: (nativeQuote.price ?? 0) > 0 && quoteSource !== "unavailable",
  };

  let chartData: ChartPoint[] = [];
  let chartSource = "synthetic";
  const cCached = cacheGet<ChartPoint[]>(chartKey, TTL.chart);
  if (cCached.fresh && cCached.data?.length) {
    chartData = chartToZar(cCached.data, nativeQuote.currency, fx);
    chartSource = "cache";
  } else if (token) {
    try {
      const liveChart = await fetchChart(token, ticker, period);
      if (liveChart.length) {
        cacheSet(chartKey, liveChart, TTL.chart);
        chartData = chartToZar(liveChart, nativeQuote.currency, fx);
        chartSource = "live";
      }
    } catch {
      /* fall through to synthetic */
    }
  }

  if (!chartData.length && quotePayload.price != null) {
    // Synthetic chart from already-converted ZAR quote
    chartData = syntheticChart(quotePayload, period);
    chartSource = "synthetic";
  }

  return json({
    quote: quotePayload,
    chart: {
      symbol: symbolParam,
      period,
      data: chartData,
      count: chartData.length,
      currency: "ZAR",
      currencyNative: nativeQuote.currency,
      available: chartData.length > 0,
      source: chartSource,
    },
    chartSource,
  });
}

function applyAiInsight(
  item: Record<string, unknown>,
  rank: number,
): Record<string, unknown> {
  const change = Number(item.changePercent ?? 0);
  const score = Math.round(Math.min(98, Math.max(38, 52 + change * 5 + Math.max(0, 21 - rank) * 1.5)));

  let prediction: string;
  let rating: string;
  let ratingColor: string;
  if (rank <= 3 && change >= 2) {
    prediction = `This stock is up ${change.toFixed(1)}% today. It is one of today's stronger moves.`;
    rating = "Strong Buy";
    ratingColor = "green";
  } else if (change >= 1.5) {
    prediction = `This stock is up ${change.toFixed(1)}% today. That looks positive for now.`;
    rating = "Buy";
    ratingColor = "green";
  } else if (change >= 0.5) {
    prediction = `This stock is up a little today (${change.toFixed(1)}%). It is holding steady.`;
    rating = "Hold";
    ratingColor = "gold";
  } else if (change >= 0) {
    prediction = `This stock is almost flat today (${change.toFixed(1)}%). Wait and watch.`;
    rating = "Hold";
    ratingColor = "gold";
  } else {
    prediction = `This stock is down ${Math.abs(change).toFixed(1)}% today. It is weaker than many peers.`;
    rating = "Caution";
    ratingColor = "red";
  }

  return { ...item, rank, aiScore: score, aiPrediction: prediction, rating, ratingColor };
}

async function handleInsights(env: Env): Promise<Response> {
  const cacheKey = "insights:top20:zar:v3";
  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(cacheKey, TTL.insights);
  if (
    fresh &&
    cached &&
    Array.isArray(cached.assets) &&
    (cached.assets as unknown[]).length >= 15
  ) {
    return json({ ...cached, stale: cached.stale ?? false, source: "cache" });
  }

  const staleBoard = cacheGetStale<Record<string, unknown>>(cacheKey);
  const token = (env.FINNHUB_API_KEY || "").trim();
  const fx = await getUsdFxRates(token);
  const byId = new Map<string, Record<string, unknown>>();

  async function fetchInsightRow(assetId: string): Promise<Record<string, unknown> | null> {
    try {
      const ticker = resolveTicker(assetId);
      const qKey = `quote:${ticker}`;
      const hit = cacheGet<QuoteData>(qKey, TTL.quote);
      // Prefer any usable quote (fresh or not) before hitting Finnhub again
      let data =
        hit.data && (hit.data.price ?? 0) > 0 && hit.data.changePercent != null
          ? hit.data
          : null;

      if (!data && token) {
        data = await fetchQuoteLight(token, ticker);
        cacheSet(qKey, data, TTL.quote);
      } else if (!data) {
        const stale = cacheGetStale<QuoteData>(qKey);
        data = stale && (stale.price ?? 0) > 0 ? stale : null;
      }

      if (!data || data.price == null || data.price <= 0 || data.changePercent == null) {
        return null;
      }

      const nativeCurrency = listingCurrency(ticker, data.currency);
      const priceZar = toZar(data.price, nativeCurrency, fx);
      if (priceZar == null || priceZar <= 0) return null;

      const displayName =
        ASSET_DISPLAY_NAMES[assetId] ||
        data.name ||
        assetId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: assetId,
        ticker,
        name: displayName,
        price: priceZar,
        priceNative: data.price,
        change: toZar(data.change, nativeCurrency, fx),
        changePercent: data.changePercent,
        changePositive: data.changePositive,
        currency: "ZAR",
        currencyNative: nativeCurrency,
        fxRateToZar: zarPerUnit(nativeCurrency, fx),
      };
    } catch {
      return null;
    }
  }

  async function runBatches(ids: string[], batchSize: number, pauseMs: number) {
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((id) => fetchInsightRow(id)));
      for (const row of results) {
        if (row?.id) byId.set(String(row.id), row);
      }
      if (i + batchSize < ids.length && token && pauseMs > 0) {
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
  }

  // Pass 1: priority-ordered universe
  await runBatches(INSIGHT_ASSET_IDS, 5, 60);

  // Pass 2: retry misses once (fills Top 20 under rate limits)
  const missing = INSIGHT_ASSET_IDS.filter((id) => !byId.has(id));
  if (missing.length && byId.size < INSIGHT_TOP_N && token) {
    await new Promise((r) => setTimeout(r, 200));
    await runBatches(missing, 3, 100);
  }

  // Pass 3: slower retry for stubborn misses
  const stillMissing = INSIGHT_ASSET_IDS.filter((id) => !byId.has(id));
  if (stillMissing.length && byId.size < INSIGHT_TOP_N && token) {
    await new Promise((r) => setTimeout(r, 350));
    await runBatches(stillMissing.slice(0, INSIGHT_TOP_N - byId.size + 5), 2, 150);
  }

  const ranked = Array.from(byId.values())
    .sort((a, b) => Number(b.changePercent) - Number(a.changePercent))
    .slice(0, INSIGHT_TOP_N)
    .map((item, idx) => applyAiInsight(item, idx + 1));

  // Prefer a fuller stale board over a thin live rebuild (cold Finnhub)
  if (
    ranked.length < 15 &&
    staleBoard &&
    Array.isArray(staleBoard.assets) &&
    (staleBoard.assets as unknown[]).length >= 15
  ) {
    return json({
      ...staleBoard,
      stale: true,
      source: "stale_cache",
      note: "Serving last full board while live quotes catch up.",
    });
  }

  const payload = {
    assets: ranked,
    count: ranked.length,
    updatedAt: new Date().toISOString(),
    stale: ranked.length < INSIGHT_TOP_N,
    source: "live",
    displayCurrency: "ZAR",
    fxSource: fx.source,
    fxUpdatedAt: fx.updatedAt,
  };

  cacheSet(cacheKey, payload, ranked.length >= 15 ? TTL.insights : 10);
  return json(payload);
}

async function handleCompare(env: Env): Promise<Response> {
  const cacheKey = "compare:full:zar:v1";
  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(cacheKey, TTL.compare);
  if (
    fresh &&
    cached &&
    Array.isArray(cached.companies) &&
    cached.compareVersion === 3 &&
    cached.verdict
  ) {
    return json({ ...cached, stale: false, source: "cache" });
  }

  const token = (env.FINNHUB_API_KEY || "").trim();
  const fx = await getUsdFxRates(token);
  const companies = await Promise.all(
    COMPARE_ASSET_IDS.map(async (assetId) => {
      const ticker = resolveTicker(assetId);
      let quote: QuoteData | null = null;
      try {
        if (token) {
          quote = await fetchQuote(token, ticker);
          cacheSet(`quote:${ticker}`, quote, TTL.quote);
        }
      } catch {
        quote = cacheGetStale<QuoteData>(`quote:${ticker}`);
      }

      const name = quote?.name || assetId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const sentiment = buildSentiment(assetId, ticker);
      const longTermScore = longTermScoreFromAnalysis(sentiment.analysis);
      const changePct = quote?.changePercent ?? null;
      const nativeCurrency = listingCurrency(ticker, quote?.currency);

      return {
        id: assetId,
        ticker,
        name,
        price: toZar(quote?.price ?? null, nativeCurrency, fx),
        priceNative: quote?.price ?? null,
        change: toZar(quote?.change ?? null, nativeCurrency, fx),
        changePercent: changePct,
        changePositive: quote?.changePositive ?? (changePct ?? 0) >= 0,
        currency: "ZAR",
        currencyNative: nativeCurrency,
        fxRateToZar: zarPerUnit(nativeCurrency, fx),
        aiScore: sentiment.aiScore,
        rating: sentiment.rating,
        explanation: sentiment.explanation,
        analysis: sentiment.analysis,
        longTermScore,
        isWinner: false,
        badges: [] as string[],
      };
    }),
  );

  const ranked = [...companies].sort((a, b) => b.longTermScore - a.longTermScore);
  const winner = ranked[0];
  const runner = ranked[1];
  const analysis = winner.analysis;
  const strengths: string[] = [];
  if (analysis.stability.pct >= 65) strengths.push("steady price history");
  if (analysis.profitability.pct >= 65) strengths.push("strong profits");
  if (analysis.growth.pct >= 65) strengths.push("healthy growth");
  const strengthText = strengths.length ? strengths.join(", ") : "balanced company health";

  let summary = `${winner.name} looks like the best long-term pick here. It scores well for ${strengthText}.`;
  if (runner) {
    const gap = winner.longTermScore - runner.longTermScore;
    summary +=
      gap >= 8
        ? ` It is clearly ahead of ${runner.name}.`
        : ` It is close with ${runner.name}, but still ahead.`;
  }

  const verdict = {
    winnerId: winner.id,
    headline: `${winner.name} is the best long-term pick here`,
    summary,
    tips: [
      "Think in years, not days. Short drops are normal.",
      "Do not put all your money in one stock. Split across 2 or 3.",
      "Check again every month. Scores can change.",
    ],
  };

  const badges: Record<string, string> = {};
  for (const key of ["growth", "profitability", "stability"] as const) {
    const best = companies.reduce((a, b) =>
      (b.analysis[key]?.pct ?? 0) > (a.analysis[key]?.pct ?? 0) ? b : a,
    );
    badges[key] = best.id;
  }

  for (const company of companies) {
    company.isWinner = company.id === winner.id;
    company.badges = (Object.keys(badges) as Array<keyof typeof COMPARE_BADGE_LABELS>)
      .filter((key) => badges[key] === company.id)
      .map((key) => COMPARE_BADGE_LABELS[key]);
  }

  const payload = {
    companies,
    verdict,
    badges,
    updatedAt: new Date().toISOString(),
    stale: companies.some((c) => c.price == null),
    source: "live",
    compareVersion: 3,
    displayCurrency: "ZAR",
    fxSource: fx.source,
    fxUpdatedAt: fx.updatedAt,
  };
  cacheSet(cacheKey, payload, TTL.compare);
  return json(payload);
}

async function handleSentiment(symbolParam: string): Promise<Response> {
  const assetId = symbolParam.toLowerCase();
  let ticker: string;
  try {
    ticker = resolveTicker(assetId);
  } catch {
    return json({ detail: "Invalid or unsupported symbol" }, 400);
  }

  const cacheKey = `sentiment:${assetId}`;
  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(cacheKey, TTL.sentiment);
  if (fresh && cached) return json({ ...cached, stale: false });

  const result = buildSentiment(assetId, ticker);
  cacheSet(cacheKey, result, TTL.sentiment);
  return json({ ...result, stale: false });
}

async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.AI) {
    return json({ detail: "Workers AI is not configured on this Worker" }, 503);
  }

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return json({ detail: "Invalid JSON body" }, 400);
  }

  const message = (body.message || "").trim();
  if (!message) return json({ detail: "Message cannot be empty" }, 400);
  if (message.length > 2000) return json({ detail: "Message too long" }, 400);

  try {
    const result = await chatWithWorkersAi(env.AI, message);
    return json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "AI service unavailable";
    return json({ detail }, 502);
  }
}

async function handleDeleteAccount(request: Request, env: Env): Promise<Response> {
  const supabaseUrl = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = (env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return json(
      {
        detail:
          "Account deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the Worker.",
      },
      503,
    );
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ detail: "Missing authorization" }, 401);

  const verifyKey = anonKey || serviceKey;
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: verifyKey,
    },
  });
  if (!userRes.ok) {
    return json({ detail: "Invalid or expired session" }, 401);
  }
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return json({ detail: "Invalid user" }, 401);

  const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!delRes.ok) {
    const detail = await delRes.text();
    return json(
      { detail: detail || "Failed to delete account" },
      delRes.status >= 400 && delRes.status < 600 ? delRes.status : 502,
    );
  }

  return json({ status: "deleted" });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return withSecurityHeaders(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }),
    );
  }

  if (
    (method === "GET" || method === "HEAD") &&
    (path === "/api/health" || path === "/health")
  ) {
    if (method === "HEAD") {
      return withSecurityHeaders(
        new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }),
      );
    }
    return json({
      status: "ok",
      timestamp: new Date().toISOString(),
      displayCurrency: "ZAR",
      market_data: {
        primary: "finnhub",
        finnhub: Boolean(env.FINNHUB_API_KEY),
      },
      ai: {
        provider: "workers-ai",
        configured: Boolean(env.AI),
      },
    });
  }

  if (method === "POST" && path === "/api/ai/chat") {
    return handleAiChat(request, env);
  }

  if (method === "DELETE" && path === "/api/account") {
    return handleDeleteAccount(request, env);
  }

  if (method === "GET" && path === "/api/compare") return handleCompare(env);
  if (method === "GET" && path === "/api/insights") return handleInsights(env);

  if (method === "GET" && path === "/api/fx") {
    const token = (env.FINNHUB_API_KEY || "").trim();
    const fx = await getUsdFxRates(token);
    return json({
      displayCurrency: "ZAR",
      base: fx.base,
      usdZar: fx.rates.ZAR,
      rates: fx.rates,
      source: fx.source,
      updatedAt: fx.updatedAt,
    });
  }

  const quoteMatch = path.match(/^\/api\/quote\/([^/]+)$/);
  if (method === "GET" && quoteMatch) return handleQuote(env, decodeURIComponent(quoteMatch[1]));

  const chartMatch = path.match(/^\/api\/chart\/([^/]+)\/([^/]+)$/);
  if (method === "GET" && chartMatch) {
    return handleChart(env, decodeURIComponent(chartMatch[1]), decodeURIComponent(chartMatch[2]));
  }

  const snapshotMatch = path.match(/^\/api\/snapshot\/([^/]+)\/([^/]+)$/);
  if (method === "GET" && snapshotMatch) {
    return handleSnapshot(
      env,
      decodeURIComponent(snapshotMatch[1]),
      decodeURIComponent(snapshotMatch[2]),
    );
  }

  const sentimentMatch = path.match(/^\/api\/sentiment\/([^/]+)$/);
  if (method === "GET" && sentimentMatch) {
    return handleSentiment(decodeURIComponent(sentimentMatch[1]));
  }

  // Actuarial engine — native TypeScript (Hardy / Lo / Hull / Barucci / Wüthrich)
  const actuarialMatch = path.match(/^\/api\/actuarial\/([^/]+)$/);
  if ((method === "GET" || method === "HEAD") && actuarialMatch) {
    return handleActuarial(
      env,
      decodeURIComponent(actuarialMatch[1]),
      url.searchParams,
      method === "HEAD",
    );
  }

  return json({ detail: "Not found" }, 404);
}

async function handleActuarial(
  env: Env,
  symbolParam: string,
  searchParams: URLSearchParams,
  headOnly: boolean,
): Promise<Response> {
  const investment = Number(searchParams.get("investment") || 10000);
  const horizon = Number(searchParams.get("horizon") || 1);
  const assetId = symbolParam.toLowerCase().trim();
  const cacheKey = `actuarial:v2:${assetId}:${Math.round(investment)}:${horizon}`;

  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(
    cacheKey,
    TTL.actuarial,
  );
  if (fresh && cached) {
    if (headOnly) {
      return withSecurityHeaders(
        new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }),
      );
    }
    return json({ ...cached, source: "cache" });
  }

  const result = await buildActuarialAnalysis(
    assetId,
    investment,
    horizon,
    env.FINNHUB_API_KEY,
  );
  cacheSet(cacheKey, result, TTL.actuarial);

  if (headOnly) {
    return withSecurityHeaders(
      new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }),
    );
  }
  return json(result);
}

/** Bake public Supabase config into HTML so CF Git builds work without Vite build vars. */
async function serveAssets(request: Request, env: Env): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return withSecurityHeaders(assetResponse);
  }

  const supabaseUrl = (env.SUPABASE_URL || "").trim();
  const supabaseAnonKey = (env.SUPABASE_ANON_KEY || "").trim();
  const googleWebClientId = (env.GOOGLE_WEB_CLIENT_ID || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return withSecurityHeaders(assetResponse, { html: true });
  }

  const html = await assetResponse.text();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const boot = `<script nonce="${nonce}">window.__CROWTH_ENV__=${JSON.stringify({
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
    ...(googleWebClientId
      ? { VITE_GOOGLE_WEB_CLIENT_ID: googleWebClientId }
      : {}),
  })};</script>`;
  const patched = html.includes("</head>")
    ? html.replace("</head>", `${boot}</head>`)
    : `${boot}${html}`;

  const headers = new Headers(assetResponse.headers);
  headers.delete("content-length");
  return withSecurityHeaders(
    new Response(patched, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    }),
    { nonce, html: true },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Internal error";
        return json({ detail }, 500);
      }
    }

    return serveAssets(request, env);
  },
} satisfies ExportedHandler<Env>;
