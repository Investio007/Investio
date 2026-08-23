/**
 * Cloudflare Worker: Crowth SPA assets + native /api (Finnhub + Workers AI).
 * Replaces the Railway FastAPI proxy for production on Cloudflare.
 */

import { cacheGet, cacheGetStale, cacheSet } from "./lib/cache";
import { chatWithWorkersAi, type AiBinding } from "./lib/ai";
import { emptyQuote, fetchChart, fetchQuote, type ChartPoint, type QuoteData } from "./lib/finnhub";
import {
  COMPARE_ASSET_IDS,
  FINNHUB_PERIOD_MAP,
  INSIGHT_ASSET_IDS,
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
  /** Optional fallback proxy if native handlers fail (legacy Railway). */
  MARKET_API_ORIGIN?: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const TTL = { quote: 60, chart: 300, compare: 60, insights: 60, sentiment: 300 };
const INSIGHT_TOP_N = 20;

const COMPARE_BADGE_LABELS: Record<string, string> = {
  growth: "Best growth",
  profitability: "Most profitable",
  stability: "Most stable",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
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
    return json({ detail: "Invalid or unsupported symbol" }, 400);
  }

  const cacheKey = `quote:${ticker}`;
  const { data: cached, fresh } = cacheGet<QuoteData>(cacheKey, TTL.quote);
  if (fresh && cached) {
    return json({ ...cached, id: symbolParam, stale: false, source: "cache" });
  }

  try {
    const token = requireToken(env);
    const data = await fetchQuote(token, ticker);
    cacheSet(cacheKey, data, TTL.quote);
    return json({ ...data, id: symbolParam, stale: false, source: "live" });
  } catch {
    const stale = cacheGetStale<QuoteData>(cacheKey);
    if (stale) return json({ ...stale, id: symbolParam, stale: true, source: "stale_cache" });
    return json({ ...emptyQuote(ticker), id: symbolParam, stale: true, source: "unavailable" });
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
  const { data: cached, fresh } = cacheGet<ChartPoint[]>(cacheKey, TTL.chart);
  if (fresh && cached?.length) {
    return json({
      symbol: symbolParam,
      period,
      data: cached,
      count: cached.length,
      stale: false,
      source: "cache",
    });
  }

  try {
    const token = requireToken(env);
    const data = await fetchChart(token, ticker, period);
    cacheSet(cacheKey, data, TTL.chart);
    return json({
      symbol: symbolParam,
      period,
      data,
      count: data.length,
      stale: false,
      source: "live",
    });
  } catch {
    const stale = cacheGetStale<ChartPoint[]>(cacheKey);
    if (stale?.length) {
      return json({
        symbol: symbolParam,
        period,
        data: stale,
        count: stale.length,
        stale: true,
        source: "stale_cache",
      });
    }
    return json({
      symbol: symbolParam,
      period,
      data: [],
      count: 0,
      stale: true,
      source: "unavailable",
    });
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

  let quotePayload: QuoteData & { id: string; stale: boolean; source: string };
  const qCached = cacheGet<QuoteData>(quoteKey, TTL.quote);
  if (qCached.fresh && qCached.data) {
    quotePayload = { ...qCached.data, id: symbolParam, stale: false, source: "cache" };
  } else {
    try {
      const token = requireToken(env);
      const live = await fetchQuote(token, ticker);
      cacheSet(quoteKey, live, TTL.quote);
      quotePayload = { ...live, id: symbolParam, stale: false, source: "live" };
    } catch {
      const stale = cacheGetStale<QuoteData>(quoteKey);
      quotePayload = stale
        ? { ...stale, id: symbolParam, stale: true, source: "stale_cache" }
        : { ...emptyQuote(ticker), id: symbolParam, stale: true, source: "unavailable" };
    }
  }

  let chartData: ChartPoint[] = [];
  let chartSource = "synthetic";
  const cCached = cacheGet<ChartPoint[]>(chartKey, TTL.chart);
  if (cCached.fresh && cCached.data?.length) {
    chartData = cCached.data;
    chartSource = "cache";
  } else if (env.FINNHUB_API_KEY) {
    try {
      const liveChart = await fetchChart(env.FINNHUB_API_KEY, ticker, period);
      if (liveChart.length) {
        chartData = liveChart;
        chartSource = "live";
        cacheSet(chartKey, liveChart, TTL.chart);
      }
    } catch {
      /* fall through to synthetic */
    }
  }

  if (!chartData.length && quotePayload.price != null) {
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
    prediction = `AI #${rank} pick — strongest live momentum, likely to lead today`;
    rating = "Strong Buy";
    ratingColor = "green";
  } else if (change >= 1.5) {
    prediction = "AI sees continued upside from today's live market strength";
    rating = "Buy";
    ratingColor = "green";
  } else if (change >= 0.5) {
    prediction = "AI flags steady gains — good short-term hold candidate";
    rating = "Hold";
    ratingColor = "gold";
  } else if (change >= 0) {
    prediction = "AI notes modest gains — watch for breakout confirmation";
    rating = "Hold";
    ratingColor = "gold";
  } else {
    prediction = "AI ranks lower today — weaker live session vs peers";
    rating = "Caution";
    ratingColor = "red";
  }

  return { ...item, rank, aiScore: score, aiPrediction: prediction, rating, ratingColor };
}

async function handleInsights(env: Env): Promise<Response> {
  const cacheKey = "insights:top20";
  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(cacheKey, TTL.insights);
  if (fresh && cached) return json({ ...cached, stale: cached.stale ?? false, source: "cache" });

  const token = (env.FINNHUB_API_KEY || "").trim();
  const items: Record<string, unknown>[] = [];

  // Batch in parallel with a modest concurrency cap
  const batchSize = 6;
  for (let i = 0; i < INSIGHT_ASSET_IDS.length; i += batchSize) {
    const batch = INSIGHT_ASSET_IDS.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (assetId) => {
        try {
          const ticker = resolveTicker(assetId);
          const qKey = `quote:${ticker}`;
          const hit = cacheGet<QuoteData>(qKey, TTL.quote);
          let data = hit.fresh ? hit.data : null;
          if (!data && token) {
            data = await fetchQuote(token, ticker);
            cacheSet(qKey, data, TTL.quote);
          } else if (!data) {
            data = cacheGetStale<QuoteData>(qKey);
          }
          if (!data || data.price == null || data.changePercent == null) return null;
          return {
            id: assetId,
            ticker,
            name: data.name || assetId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            changePositive: data.changePositive,
            currency: data.currency || "USD",
          };
        } catch {
          return null;
        }
      }),
    );
    for (const row of results) if (row) items.push(row);
  }

  const ranked = items
    .sort((a, b) => Number(b.changePercent) - Number(a.changePercent))
    .slice(0, INSIGHT_TOP_N)
    .map((item, idx) => applyAiInsight(item, idx + 1));

  const payload = {
    assets: ranked,
    count: ranked.length,
    updatedAt: new Date().toISOString(),
    stale: ranked.length < INSIGHT_TOP_N,
    source: "live",
  };
  cacheSet(cacheKey, payload, TTL.insights);
  return json(payload);
}

async function handleCompare(env: Env): Promise<Response> {
  const cacheKey = "compare:full";
  const { data: cached, fresh } = cacheGet<Record<string, unknown>>(cacheKey, TTL.compare);
  if (
    fresh &&
    cached &&
    Array.isArray(cached.companies) &&
    cached.compareVersion === 2 &&
    cached.verdict
  ) {
    return json({ ...cached, stale: false, source: "cache" });
  }

  const token = (env.FINNHUB_API_KEY || "").trim();
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

      return {
        id: assetId,
        ticker,
        name,
        price: quote?.price ?? null,
        change: quote?.change ?? null,
        changePercent: changePct,
        changePositive: quote?.changePositive ?? (changePct ?? 0) >= 0,
        currency: quote?.currency || "USD",
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

  let summary = `Based on live market prices and company health scores, ${winner.name} scores highest for holding 5+ years. It stands out for ${strengthText}.`;
  if (runner) {
    const gap = winner.longTermScore - runner.longTermScore;
    summary +=
      gap >= 8
        ? ` It leads ${runner.name} by a clear margin — a safer long-term pick right now.`
        : ` It's close with ${runner.name}. Both are solid, but ${winner.name} edges ahead overall.`;
  }

  const verdict = {
    winnerId: winner.id,
    headline: `${winner.name} is the best long-term pick here`,
    summary,
    tips: [
      "Think in years, not days — short dips are normal.",
      "Don't put all your money in one company; spread across 2–3 strong picks.",
      "Scores refresh with live data — check back monthly.",
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
    compareVersion: 2,
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

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return withSecurityHeaders(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }),
    );
  }

  if (method === "GET" && (path === "/api/health" || path === "/health")) {
    return json({
      status: "ok",
      timestamp: new Date().toISOString(),
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

  if (method === "GET" && path === "/api/compare") return handleCompare(env);
  if (method === "GET" && path === "/api/insights") return handleInsights(env);

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

  return json({ detail: "Not found" }, 404);
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
  if (!supabaseUrl || !supabaseAnonKey) {
    return withSecurityHeaders(assetResponse);
  }

  const html = await assetResponse.text();
  const boot = `<script>window.__CROWTH_ENV__=${JSON.stringify({
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
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
