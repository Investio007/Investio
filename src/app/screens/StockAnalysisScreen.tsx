import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import type { AnalysisValue, CrowthAsset } from "../data/assets";
import {
  resolveAssetForAnalysis,
  type AssetAnalysisState,
} from "../lib/assetAnalysisNav";
import {
  analysisFromScore,
  formatMarketPrice,
  formatNativeListingPrice,
  momentumRating,
  todaysMomentumScore,
} from "../lib/formatMarketPrice";
import { limitPlainSentences } from "../lib/plainEnglish";
import PriceChart from "../components/PriceChart";
import PriceSkeleton from "../components/PriceSkeleton";
import { useActuarial, useMarketSnapshot } from "../hooks/useMarketData";
import { getMarketApiBaseUrl } from "../lib/marketApiBaseUrl";
import { useAddToPortfolioWithPicker } from "../hooks/useAddToPortfolioWithPicker";
import { captureEvent } from "../../lib/analytics";

type SentimentData = {
  aiScore: number;
  rating: string;
  explanation: string;
  analysis: {
    growth: AnalysisValue;
    profitability: AnalysisValue;
    stability: AnalysisValue;
    competition: AnalysisValue;
  };
  newsSentimentScore: number;
  stale?: boolean;
};

type AnalysisRow = AnalysisValue & { question?: string };

const getRatingColor = (rating: "green" | "gold" | "red") => {
  switch (rating) {
    case "green":
      return "bg-[#007A4D]";
    case "gold":
      return "bg-[#FFB612]";
    case "red":
      return "bg-[#E03A3E]";
  }
};

function asBarColor(color: string): "green" | "gold" | "red" {
  if (color === "green" || color === "gold" || color === "red") return color;
  return "gold";
}

function AssetNotFound({
  attempted,
  onBack,
}: {
  attempted: string;
  onBack: () => void;
}) {
  return (
    <div className="min-h-full bg-[#F5F7FA] pb-10">
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>
        <h1 className="text-2xl font-bold text-[#0A1F44] mb-2">
          Stock not found
        </h1>
        <p className="text-sm text-gray-600">
          {attempted
            ? `We couldn’t open “${attempted}”. Go back and try again.`
            : "We couldn’t open this stock. Go back and try again."}
        </p>
      </div>
      <div className="px-6">
        <Button
          type="button"
          onClick={onBack}
          className="w-full h-12 rounded-2xl bg-[#0A1F44] text-white"
        >
          Go back
        </Button>
      </div>
    </div>
  );
}

export function StockAnalysisScreen() {
  const labelMap: Record<string, string> = {
    growth: "Is it growing?",
    profitability: "Does it make money?",
    stability: "Is the price stable?",
    competition: "Is the news good?",
  };

  const barLabelMap: Record<string, string> = {
    Strong: "Good",
    Moderate: "Average",
    Weak: "Risky",
    High: "Risky",
    Good: "Good",
    Average: "Average",
    Risky: "Risky",
  };

  const ratingTextMap: Record<string, string> = {
    "Strong Investment": "Looks Good to Invest",
    "Moderate Investment": "Could Be Worth It",
    "Proceed with Caution": "Be Careful With This One",
    "High Risk": "Too Risky Right Now",
    "Strong Buy": "Looks Good to Invest",
    Hold: "Could Be Worth It",
  };

  const navigate = useNavigate();
  const location = useLocation();
  const { symbol } = useParams<{ symbol: string }>();
  const { requestAdd, pickerDialog } = useAddToPortfolioWithPicker();
  const locationState = (location.state as AssetAnalysisState | null) ?? null;

  const stock: CrowthAsset | null = resolveAssetForAnalysis(
    locationState,
    symbol,
  );
  const stockId = stock?.id ?? "";
  const attemptedLabel =
    locationState?.asset?.name ||
    locationState?.assetId ||
    (symbol ? decodeURIComponent(symbol) : "") ||
    "";

  const {
    quote,
    chart,
    chartSource,
    loading: quoteLoading,
    error: quoteError,
  } = useMarketSnapshot(stockId, "1M");

  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(true);

  const { data: actuarial, loading: actuarialLoading } = useActuarial(
    stockId,
    10000,
  );

  useEffect(() => {
    if (!stockId) {
      setSentiment(null);
      setSentimentLoading(false);
      return;
    }
    let cancelled = false;
    setSentimentLoading(true);
    fetch(`${getMarketApiBaseUrl()}/api/sentiment/${stockId}`, {
      cache: "no-store",
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Sentiment unavailable")),
      )
      .then((data: SentimentData) => {
        if (!cancelled) setSentiment(data);
      })
      .catch(() => {
        if (!cancelled) setSentiment(null);
      })
      .finally(() => {
        if (!cancelled) setSentimentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stockId]);

  useEffect(() => {
    if (!stock) return;
    captureEvent("stock_viewed", {
      stock_id: stock.id,
      ticker: stock.ticker,
      name: stock.name,
    });
  }, [stock]);

  if (!stock) {
    return (
      <AssetNotFound
        attempted={attemptedLabel}
        onBack={() => navigate(-1)}
      />
    );
  }

  // Same rules for every stock:
  // 1) Live momentum (matches Home insights formula) — today's move
  // 2) Score passed in via navigation (insights / compare)
  // 3) Live actuarial / sentiment / static fallback (never fake mid-scores)
  const fromNav = Boolean(locationState?.asset);
  const navScore = locationState?.asset?.aiScore;
  const navRating = locationState?.asset?.rating;
  const quoteOk =
    Boolean(quote) &&
    !quoteError &&
    quote?.available !== false &&
    quote?.source !== "unavailable" &&
    quote?.price != null;
  const momentumScore =
    quoteOk && quote?.changePercent != null
      ? todaysMomentumScore(quote.changePercent)
      : null;
  const momentumMeta =
    quoteOk && quote?.changePercent != null
      ? momentumRating(quote.changePercent)
      : null;

  const actuarialUsable =
    actuarial?.available !== false &&
    actuarial?.source !== "error_fallback" &&
    actuarial?.source !== "insufficient_data" &&
    actuarial?.source !== "fallback" &&
    actuarial?.score?.score != null;

  const primaryScore =
    momentumScore ??
    (navScore != null ? navScore : null) ??
    (actuarialUsable ? actuarial!.score.score : null) ??
    sentiment?.aiScore ??
    stock.aiScore;

  const usingLiveMomentum = momentumScore != null;

  const analysisData = usingLiveMomentum
    ? analysisFromScore(momentumScore)
    : fromNav && stock.analysis
      ? stock.analysis
      : actuarialUsable
        ? actuarial!.analysis
        : (sentiment?.analysis ?? stock.analysis);

  const aiScore = primaryScore;
  const ratingLabel =
    (momentumMeta ? ratingTextMap[momentumMeta.rating] ?? momentumMeta.rating : null) ??
    (navRating ? ratingTextMap[navRating] ?? navRating : null) ??
    (actuarialUsable ? actuarial?.score.label : null) ??
    sentiment?.rating ??
    ratingTextMap[stock.rating || "Hold"] ??
    stock.rating ??
    "AI Analysis";
  const explanations = limitPlainSentences(
    (actuarialUsable ? actuarial?.explanation : null) ??
      (usingLiveMomentum
        ? momentumMeta?.rating === "Strong Buy" || momentumMeta?.rating === "Buy"
          ? "This stock looks strong today compared with others. The AI score shows today's short-term move."
          : momentumMeta?.rating === "Caution"
            ? "This stock looks weaker today compared with others. The AI score shows today's short-term move."
            : "The AI score shows how this stock moved today compared with others."
        : null) ??
      (fromNav && stock.explanation ? stock.explanation : null) ??
      sentiment?.explanation ??
      stock.explanation,
    5,
  );
  const isLoading = momentumScore == null && actuarialLoading && !actuarial;
  const scoreLoading = isLoading && sentimentLoading && navScore == null;
  const booksUsed = actuarialUsable ? (actuarial?.books_used ?? []) : [];
  const multiHorizon = actuarialUsable
    ? (actuarial?.metrics?.multi_horizon ?? [])
    : [];
  const regime = actuarialUsable ? (actuarial?.metrics?.regime ?? null) : null;
  const options = actuarialUsable ? (actuarial?.metrics?.options ?? null) : null;
  const investmentAmount = actuarial?.investment ?? 10000;
  const protectionCostRand =
    options != null
      ? investmentAmount * ((options.downside_protection_cost_pct ?? 0) / 100)
      : 0;

  const actuarialScore = actuarialUsable ? actuarial?.score.score : null;
  const showActuarialAside =
    actuarialScore != null &&
    Math.abs(actuarialScore - (aiScore ?? actuarialScore)) >= 15;

  const displayPrice =
    quoteOk && quote?.price != null
      ? formatMarketPrice(quote.price, quote.currency ?? "ZAR", stock.ticker)
      : stock.price.startsWith("$")
        ? "—"
        : stock.price;

  const displayChange =
    quoteOk && quote?.changePercent != null
      ? `${quote.changePositive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
      : stock.change;
  const displayChangePositive = quoteOk
    ? (quote?.changePositive ?? stock.changePositive)
    : stock.changePositive;

  const getRatingBgColor = (score: number | null | undefined) => {
    const value = score ?? 50;
    if (value >= 70) return "bg-[#007A4D]/10 text-[#007A4D]";
    if (value >= 55) return "bg-[#FFB612]/10 text-[#FFB612]";
    if (value >= 40) return "bg-[#FFB612]/10 text-[#FFB612]";
    return "bg-[#E03A3E]/10 text-[#E03A3E]";
  };

  const headerRatingScore = aiScore;
  const scoreTitle = usingLiveMomentum
    ? "Today’s move score"
    : "Our AI Score";
  const scoreHint = usingLiveMomentum
    ? "Based on today’s price move versus peers."
    : "A simple score for beginners. Higher is stronger right now.";

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-10">
      {/* Header */}
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <div>
          <h1 className="text-2xl font-bold text-[#0A1F44] mb-2">
            {stock.name}
          </h1>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[#0A1F44]">
              {quoteLoading ? <PriceSkeleton /> : displayPrice}
            </span>
            <div
              className={`flex items-center gap-1 ${
                displayChangePositive ? "text-[#007A4D]" : "text-[#E03A3E]"
              }`}
            >
              {displayChangePositive ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              <span className="font-medium">{displayChange}</span>
            </div>
          </div>
          {quote &&
            !quoteError &&
            quote.currencyNative &&
            quote.currencyNative !== "ZAR" &&
            quote.priceNative != null && (
              <p className="mt-2 text-xs text-gray-500">
                Auto-converted to rand from{" "}
                {formatNativeListingPrice(
                  quote.priceNative,
                  quote.currencyNative,
                )}
                {quote.fxRateToZar != null
                  ? ` · 1 ${quote.currencyNative} ≈ R${quote.fxRateToZar.toFixed(2)}`
                  : ""}
              </p>
            )}
          {quoteError && (
            <p className="mt-2 text-xs text-[#E03A3E]">{quoteError}</p>
          )}
        </div>

        <div
          className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${getRatingBgColor(
            headerRatingScore,
          )}`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">
            {scoreLoading ? "Checking..." : ratingLabel}
          </span>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600 mb-1">{scoreTitle}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[#0A1F44]">
                  {scoreLoading ? "—" : (aiScore ?? "—")}
                </span>
                <span className="text-gray-500">/ 100</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{scoreHint}</p>
            </div>
            <div
              className={`px-4 py-2 rounded-xl font-medium ${getRatingBgColor(aiScore)}`}
            >
              {scoreLoading ? "Checking..." : ratingLabel}
            </div>
          </div>

          {showActuarialAside && (
            <p className="text-xs text-gray-500 mb-2 leading-relaxed">
              Today’s score is about the short-term move. Longer-term risk score:{" "}
              <span className="font-semibold text-[#0A1F44]">
                {actuarialScore}/100
              </span>
              {actuarial?.score.label ? ` · ${actuarial.score.label}` : ""}.
            </p>
          )}
          {!actuarialUsable &&
            actuarial &&
            (actuarial.source === "error_fallback" ||
              actuarial.source === "insufficient_data") && (
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                Longer-term risk score is not available right now.
              </p>
            )}

          <div className="mt-6">
            <p className="text-sm text-gray-600 mb-3">Recent Price Movement</p>
            <PriceChart
              points={chart?.data ?? []}
              period="1M"
              height={80}
              compact
              loading={quoteLoading && (chart?.data?.length ?? 0) === 0}
              approximate={
                chartSource === "synthetic" || chartSource === "stale_cache"
              }
              color="#007A4D"
            />
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-6">AI Analysis</h3>

          <div className="space-y-4">
            {Object.entries(analysisData).map(([key, value]) => {
              const row = value as AnalysisRow;
              const question =
                row.question ??
                labelMap[key] ??
                key.charAt(0).toUpperCase() + key.slice(1);
              const barColor = asBarColor(row.color);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-700">{question}</span>
                  <div className="flex items-center gap-3 w-[65%]">
                    <div
                      className={`h-2 rounded-full ${getRatingColor(barColor)}`}
                      style={{
                        width: isLoading ? "50%" : `${row.pct}%`,
                        transition: "width 0.8s ease",
                      }}
                    />
                    <span className="text-sm font-medium text-gray-600">
                      {isLoading
                        ? "..."
                        : barLabelMap[row.label] || row.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {sentiment && !sentimentLoading && !actuarial && (
            <div className="text-[11px] text-[#9ca3af] mt-8 text-right">
              Based on{" "}
              {sentiment.newsSentimentScore > 60
                ? "mostly positive"
                : sentiment.newsSentimentScore > 40
                  ? "mixed"
                  : "mostly negative"}{" "}
              news right now
            </div>
          )}

          {sentiment?.stale && !actuarial && (
            <div className="text-[10px] text-[#FFB612] mt-1">
              ● Data last updated a few minutes ago
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-4">
            Simple Explanation
          </h3>
          <div className="mb-2">
            {isLoading && explanations.length === 0 ? (
              <div
                className="h-4 w-[85%] rounded-md bg-[#f3f4f6] mb-2 animate-pulse"
              />
            ) : (
              explanations.map((line, i) => (
                <p
                  key={i}
                  className="text-[#1F2937] text-sm leading-relaxed mb-2"
                >
                  {line}
                </p>
              ))
            )}
          </div>
        </Card>

        {regime && !isLoading && (
          <div
            className="rounded-xl px-3.5 py-3"
            style={{
              background:
                regime.color === "green"
                  ? "#e6f5ef"
                  : regime.color === "red"
                    ? "#fdeaea"
                    : "#fff8e6",
              border: `1px solid ${
                regime.color === "green"
                  ? "#007A4D"
                  : regime.color === "red"
                    ? "#E03A3E"
                    : "#FFB612"
              }`,
            }}
          >
            <div
              className="text-xs font-semibold mb-1"
              style={{
                color:
                  regime.color === "green"
                    ? "#007A4D"
                    : regime.color === "red"
                      ? "#E03A3E"
                      : "#b87e00",
              }}
            >
              Market Mood: {regime.simple_label}
            </div>
            <div className="text-xs text-[#374151] leading-snug">
              {regime.advice}
            </div>
          </div>
        )}

        {options && !isLoading && (
          <div className="bg-[#F5F7FA] rounded-xl px-3.5 py-3">
            <div className="text-xs font-semibold text-[#0A1F44] mb-1">
              Safety cost
            </div>
            <div className="text-xs text-[#374151] leading-snug">
              To protect R
              {investmentAmount.toLocaleString("en-ZA", {
                maximumFractionDigits: 0,
              })}{" "}
              from losses for 1 year would cost about{" "}
              <strong>
                R
                {protectionCostRand.toLocaleString("en-ZA", {
                  maximumFractionDigits: 0,
                })}
              </strong>
              . Think of it like insurance for your money.
            </div>
          </div>
        )}

        {multiHorizon.length > 0 && !isLoading && (
          <div>
            <div className="text-[13px] font-medium text-[#0A1F44] mb-2.5">
              Risk over time
            </div>
            <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_1fr] px-3 py-2 bg-[#F5F7FA] border-b border-[#e5e7eb]">
                <span className="text-[11px] font-semibold text-[#6b7280]">
                  Period
                </span>
                <span className="text-[11px] font-semibold text-[#007A4D] text-center">
                  Expected value
                </span>
                <span className="text-[11px] font-semibold text-[#E03A3E] text-right">
                  Worst case loss
                </span>
              </div>
              {multiHorizon.map((h) => (
                <div
                  key={h.horizon}
                  className="grid grid-cols-[60px_1fr_1fr] px-3 py-2.5 border-b border-[#f3f4f6] items-center"
                >
                  <span className="text-xs font-medium text-[#0A1F44]">
                    {h.horizon}
                  </span>
                  <span className="text-xs text-[#007A4D] text-center">
                    R
                    {h.expected_value?.toLocaleString("en-ZA", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="text-xs text-[#E03A3E] text-right">
                    −R
                    {h.var_95?.toLocaleString("en-ZA", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-[#9ca3af] mt-1.5">
              Worst case is a very bad year. It does not happen often.
            </div>
          </div>
        )}

        {booksUsed.length > 0 && !isLoading && (
          <div className="bg-[#F5F7FA] rounded-[10px] px-3.5 py-2.5">
            <div className="text-[11px] text-[#9ca3af] mb-0.5 font-medium">
              Built with trusted finance methods for beginners.
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={() => requestAdd(stock)}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-14 rounded-2xl text-lg mb-4"
        >
          Add to Demo Portfolio
        </Button>
      </div>
      {pickerDialog}
    </div>
  );
}
