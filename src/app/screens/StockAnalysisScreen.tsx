import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { assets, companies } from "../data/assets";
import type { AnalysisValue } from "../data/assets";
import PriceChart from "../components/PriceChart";
import PriceSkeleton from "../components/PriceSkeleton";
import { useMarketSnapshot } from "../hooks/useMarketData";
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
  const allItems = [...assets, ...companies];
  const symbolLookup = symbol
    ? allItems.find((item) => item.ticker === symbol)
    : null;
  const stateAssetId = (location.state as { assetId?: string } | null)?.assetId;
  const stateLookup = stateAssetId
    ? allItems.find((item) => item.id === stateAssetId)
    : null;
  const stock = stateLookup || symbolLookup || assets[0];
  const {
    quote,
    chart,
    chartSource,
    loading: quoteLoading,
    error: quoteError,
  } = useMarketSnapshot(stock.id, "1M");

  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSentimentLoading(true);
    fetch(`${getMarketApiBaseUrl()}/api/sentiment/${stock.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Sentiment unavailable"))))
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
  }, [stock.id]);

  useEffect(() => {
    captureEvent("stock_viewed", {
      stock_id: stock.id,
      ticker: stock.ticker,
      name: stock.name,
    });
  }, [stock.id, stock.ticker, stock.name]);

  const aiScore = sentiment?.aiScore ?? stock.aiScore;
  const ratingLabel =
    sentiment?.rating ||
    ratingTextMap[stock.rating || "Hold"] ||
    stock.rating ||
    "Hold";
  const analysis = sentiment?.analysis ?? stock.analysis;

  const displayPrice =
    quote && !quoteError && quote.price != null
      ? `${quote.currency === "USD" ? "$" : "R"}${quote.price.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : stock.price;

  const displayChange =
    quote && !quoteError && quote.changePercent != null
      ? `${quote.changePositive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
      : stock.change;
  const displayChangePositive =
    quote && !quoteError ? (quote.changePositive ?? stock.changePositive) : stock.changePositive;

  const getRatingBgColor = (score: number) => {
    if (score >= 70) return "bg-[#007A4D]/10 text-[#007A4D]";
    if (score >= 55) return "bg-[#FFB612]/10 text-[#FFB612]";
    if (score >= 40) return "bg-[#FFB612]/10 text-[#FFB612]";
    return "bg-[#E03A3E]/10 text-[#E03A3E]";
  };

  const headerRatingScore = sentiment?.aiScore ?? stock.aiScore;

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-8">
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
        </div>

        <div
          className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${getRatingBgColor(
            headerRatingScore
          )}`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">
            {sentimentLoading ? "Checking..." : ratingLabel}
          </span>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600 mb-1">Our AI Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[#0A1F44]">
                  {sentimentLoading ? "—" : aiScore}
                </span>
                <span className="text-gray-500">/ 100</span>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-xl font-medium ${getRatingBgColor(aiScore ?? 50)}`}
            >
              {sentimentLoading ? "Checking..." : ratingLabel}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-600 mb-3">Recent Price Movement</p>
            <PriceChart
              points={chart?.data ?? []}
              period="1M"
              height={80}
              compact
              loading={quoteLoading && (chart?.data?.length ?? 0) === 0}
              approximate={chartSource === "synthetic" || chartSource === "stale_cache"}
              color="#007A4D"
            />
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-6">AI Analysis</h3>

          <div className="space-y-4">
            {Object.entries(analysis).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-700">{labelMap[key] || key}</span>
                <div className="flex items-center gap-3 w-[65%]">
                  <div
                    className={`h-2 rounded-full ${getRatingColor(value.color)}`}
                    style={{ width: `${value.pct}%` }}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    {barLabelMap[value.label] || value.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {sentiment && !sentimentLoading && (
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

          {sentiment?.stale && (
            <div className="text-[10px] text-[#FFB612] mt-1">
              ● Data last updated a few minutes ago
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-4">
            Simple Explanation
          </h3>
          <p className="text-[#1F2937] text-sm leading-relaxed">
            {sentimentLoading
              ? "Checking this investment..."
              : sentiment?.explanation || stock.explanation}
          </p>
        </Card>

        <Button
          type="button"
          onClick={() => requestAdd(stock)}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-14 rounded-2xl text-lg"
        >
          Add to Demo Portfolio
        </Button>
      </div>
      {pickerDialog}
    </div>
  );
}
