import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowUp,
  ChevronRight,
  Target,
  GitCompare,
  Plus,
  ArrowDown,
  LogOut,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Card } from "../components/ui/card";
import { useInvestio } from "../context/InvestioContext";
import { useAddToPortfolioWithPicker } from "../hooks/useAddToPortfolioWithPicker";
import { companies, type InvestioAsset } from "../data/assets";
import {
  COUNTRY_MARKETS,
  getCountryById,
  getStocksForCountry,
} from "../data/countryMarkets";
import PriceChart from "../components/PriceChart";
import { useInsights, useMarketSnapshot } from "../hooks/useMarketData";
import PriceSkeleton from "../components/PriceSkeleton";
import type { MarketInsight, Period } from "../services/marketApi";

const PERIODS: Period[] = ["1D", "1W", "1M", "6M", "1Y"];

const getRatingColor = (rating: string) => {
  switch (rating) {
    case "green":
      return "bg-[#007A4D]";
    case "gold":
      return "bg-[#FFB612]";
    case "red":
      return "bg-[#E03A3E]";
    default:
      return "bg-gray-500";
  }
};

function formatInsightPrice(insight: MarketInsight): string {
  if (insight.price == null) return "—";
  const prefix =
    insight.currency === "USD"
      ? "$"
      : insight.currency === "ZAR"
        ? "R"
        : `${insight.currency} `;
  return `${prefix}${insight.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function insightToAsset(insight: MarketInsight): InvestioAsset {
  const existing = companies.find((company) => company.id === insight.id);
  if (existing) return existing;

  return {
    id: insight.id,
    name: insight.name,
    ticker: insight.ticker,
    price: formatInsightPrice(insight),
    priceRaw: insight.price ?? 0,
    change: `${insight.changePositive ? "+" : ""}${insight.changePercent?.toFixed(1) ?? "0"}%`,
    changePositive: insight.changePositive,
    rating: insight.rating,
    ratingColor: insight.ratingColor,
    aiScore: insight.aiScore,
    description: insight.aiPrediction,
    analysis: {
      growth: { label: "Strong", color: "green", pct: insight.aiScore },
      profitability: { label: "Moderate", color: "gold", pct: 60 },
      stability: { label: "Moderate", color: "gold", pct: 55 },
      competition: { label: "Moderate", color: "gold", pct: 50 },
    },
    explanation: insight.aiPrediction,
    chartPath: "M0 40 C80 35 160 30 240 25 C280 20 320 15 320 10",
  };
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "Updating…";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Live";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { demoBalance } = useInvestio();
  const { requestAdd, pickerDialog } = useAddToPortfolioWithPicker();
  const { data: insights, updatedAt, loading: insightsLoading, error: insightsError } = useInsights();
  const [selectedCountryId, setSelectedCountryId] = useState(COUNTRY_MARKETS[0].id);
  const [selectedStockId, setSelectedStockId] = useState(
    getStocksForCountry(COUNTRY_MARKETS[0].id)[0]?.id ?? "apple",
  );
  const [activePeriod, setActivePeriod] = useState<Period>("1D");

  const selectedCountry = getCountryById(selectedCountryId) ?? COUNTRY_MARKETS[0];
  const countryStocks = getStocksForCountry(selectedCountryId);
  const selectedStock =
    countryStocks.find((stock) => stock.id === selectedStockId) ??
    countryStocks[0] ??
    getStocksForCountry("us")[0];

  const handleCountrySelect = (countryId: string) => {
    const stocks = getStocksForCountry(countryId);
    setSelectedCountryId(countryId);
    setSelectedStockId(stocks[0]?.id ?? "apple");
  };

  useEffect(() => {
    const stocks = getStocksForCountry(selectedCountryId);
    if (stocks.length === 0) return;
    if (!stocks.some((stock) => stock.id === selectedStockId)) {
      setSelectedStockId(stocks[0].id);
    }
  }, [selectedCountryId, selectedStockId]);

  const {
    quote: selectedQuote,
    chart: selectedChart,
    chartSource,
    loading: marketLoading,
  } = useMarketSnapshot(selectedStock?.id ?? "apple", activePeriod);

  const quoteMatchesStock = selectedQuote?.id === selectedStock?.id;
  const displayQuote = quoteMatchesStock ? selectedQuote : null;
  const isMarketLoading = marketLoading && !displayQuote;
  const chartPoints = quoteMatchesStock ? (selectedChart?.data ?? []) : [];
  const chartIsApproximate =
    chartSource === "synthetic" || chartSource === "stale_cache";

  const dailyChangePct = 1.68;
  const dailyChangeAmount = Math.round(demoBalance * (dailyChangePct / 100));

  return (
    <div className="relative min-h-full bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#0A1F44] text-white px-6 pt-12 pb-24 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-white/80 mb-1">Welcome back</p>
            <h1 className="text-2xl font-bold">Your Demo Portfolio</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut();
                }
                localStorage.clear();
                navigate("/auth");
              }}
              className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/add-funds")}
              className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Add funds"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 pb-6">
        {/* Portfolio Value Card */}
        <Card className="p-6 mb-6 rounded-3xl shadow-lg border-0">
          <div className="mb-4">
            <p className="text-gray-600 mb-2">Demo Portfolio Value</p>
            <h2 className="text-4xl font-bold text-[#0A1F44]">
              R {demoBalance.toLocaleString()}
            </h2>
            <p className="text-sm text-[#007A4D] font-medium mt-2 flex items-center gap-1">
              <ArrowUp className="w-4 h-4 shrink-0" />
              <span>
                +R{dailyChangeAmount.toLocaleString()} Today ({dailyChangePct}%)
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Simulation Mode — No real funds used
            </p>
          </div>

          {/* Country selector */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide">
              Browse by Country
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {COUNTRY_MARKETS.map((country) => {
                const isSelected = selectedCountryId === country.id;
                return (
                  <button
                    key={country.id}
                    type="button"
                    onClick={() => handleCountrySelect(country.id)}
                    className={`flex-shrink-0 snap-start flex flex-col items-center justify-center min-w-[72px] px-3 py-2.5 rounded-2xl border transition-colors ${
                      isSelected
                        ? "border-[#0A1F44] bg-[#0A1F44]/5"
                        : "border-[#0A1F44]/12 bg-[#F5F7FA] hover:border-[#0A1F44]/25"
                    }`}
                    aria-label={country.name}
                    aria-pressed={isSelected}
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {country.flag}
                    </span>
                    <span
                      className={`text-[10px] font-semibold mt-1.5 text-center leading-tight ${
                        isSelected ? "text-[#0A1F44]" : "text-gray-600"
                      }`}
                    >
                      {country.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide">
              Select Stock
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Stocks in {selectedCountry.name} — swipe and tap to update the live chart
            </p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {countryStocks.map((stock) => {
                const isSelected = selectedStock?.id === stock.id;
                return (
                  <button
                    key={stock.id}
                    type="button"
                    onClick={() => setSelectedStockId(stock.id)}
                    className={`flex-shrink-0 snap-start min-w-[132px] max-w-[160px] px-4 py-3 rounded-2xl border text-left transition-colors ${
                      isSelected
                        ? "border-[#007A4D] bg-[#007A4D]/8"
                        : "border-[#0A1F44]/15 bg-white hover:border-[#0A1F44]/30"
                    }`}
                  >
                    <span
                      className={`block text-sm font-semibold leading-tight ${
                        isSelected ? "text-[#007A4D]" : "text-[#0A1F44]"
                      }`}
                    >
                      {stock.name}
                    </span>
                    <span className="block text-[10px] text-gray-500 mt-1 font-medium">
                      {stock.ticker}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedStock && (
              <>
            <div className="mt-4 mb-2">
              <p className="text-base font-bold text-[#0A1F44]">
                {displayQuote?.name ?? selectedStock.name}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                {isMarketLoading ? (
                  <div style={{ width: 100 }}>
                    <PriceSkeleton />
                  </div>
                ) : (
                  <>
                    <span className="text-xl font-bold text-[#0A1F44]">
                      {displayQuote?.currency === "ZAr" ||
                      displayQuote?.currency === "ZAR"
                        ? "R"
                        : displayQuote?.currency === "USD"
                          ? "$"
                          : displayQuote?.currency || "$"}{" "}
                      {displayQuote?.price?.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) ?? "—"}
                    </span>
                    {displayQuote?.changePercent != null && (
                      <span
                        className={`text-xs font-medium ${
                          displayQuote.changePositive
                            ? "text-[#007A4D]"
                            : "text-[#E03A3E]"
                        }`}
                      >
                        {displayQuote.changePositive ? "↑" : "↓"}{" "}
                        {Math.abs(displayQuote.changePercent).toFixed(2)}%
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">
                      {displayQuote?.ticker ?? selectedStock.ticker}
                    </span>
                  </>
                )}
              </div>
            </div>

            <PriceChart
              points={chartPoints}
              period={activePeriod}
              height={120}
              loading={isMarketLoading && chartPoints.length === 0}
              approximate={chartIsApproximate}
              color={
                displayQuote?.changePositive === false ? "#E03A3E" : "#007A4D"
              }
            />

            <div className="period-btn-row">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setActivePeriod(period)}
                  className={`period-btn${activePeriod === period ? " active" : ""}`}
                >
                  {period}
                </button>
              ))}
            </div>
              </>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate("/portfolio-builder")}
            className="bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-[#F5F7FA] rounded-2xl flex items-center justify-center">
              <Target className="w-6 h-6 text-[#0A1F44]" />
            </div>
            <span className="text-sm font-medium text-[#0A1F44]">
              Build Portfolio
            </span>
          </button>
          <button
            onClick={() => navigate("/compare")}
            className="bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-[#F5F7FA] rounded-2xl flex items-center justify-center">
              <GitCompare className="w-6 h-6 text-[#0A1F44]" />
            </div>
            <span className="text-sm font-medium text-[#0A1F44]">Compare</span>
          </button>
        </div>

        {/* AI Market Insights — live top 20 performers */}
        <div className="mb-6">
          <div className="flex items-end justify-between mb-2">
            <h3 className="text-xl font-bold text-[#0A1F44]">AI Market Insights</h3>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Live top 20
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Ranked by today&apos;s live performance · AI predictions update with market data
            {updatedAt ? ` · ${formatUpdatedAt(updatedAt)}` : ""}
          </p>

          {insightsError && (
            <p className="text-sm text-[#E03A3E] mb-3">
              Could not load live rankings. Retrying…
            </p>
          )}

          <div className="space-y-3 max-h-[28rem] overflow-y-auto scrollbar-hide pr-1">
            {insightsLoading && insights.length === 0 ? (
              Array.from({ length: 5 }).map((_, index) => (
                <Card key={index} className="p-4 rounded-2xl shadow-sm border-0">
                  <PriceSkeleton />
                </Card>
              ))
            ) : insights.length === 0 ? (
              <Card className="p-4 rounded-2xl shadow-sm border-0 text-sm text-gray-500">
                No live performers available right now. Check back shortly.
              </Card>
            ) : (
              insights.map((insight) => {
                const change = `${insight.changePositive ? "+" : ""}${insight.changePercent?.toFixed(1) ?? "0"}%`;

                return (
                  <Card
                    key={insight.id}
                    className="p-4 rounded-2xl shadow-sm border-0 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-xl bg-[#0A1F44] text-white text-xs font-bold flex items-center justify-center">
                          #{insight.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-bold text-[#0A1F44] truncate">
                              {insight.name}
                            </h4>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {insight.ticker}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-lg font-bold text-[#0A1F44]">
                              {formatInsightPrice(insight)}
                            </span>
                            <div
                              className={`flex items-center gap-1 text-sm font-medium ${
                                insight.changePositive
                                  ? "text-[#007A4D]"
                                  : "text-[#E03A3E]"
                              }`}
                            >
                              {insight.changePositive ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )}
                              <span>{change} today</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                          insight.ratingColor === "green"
                            ? "bg-[#007A4D]/10"
                            : insight.ratingColor === "gold"
                              ? "bg-[#FFB612]/10"
                              : "bg-[#E03A3E]/10"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${getRatingColor(
                            insight.ratingColor,
                          )}`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            insight.ratingColor === "green"
                              ? "text-[#007A4D]"
                              : insight.ratingColor === "gold"
                                ? "text-[#FFB612]"
                                : "text-[#E03A3E]"
                          }`}
                        >
                          {insight.rating}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-1">{insight.aiPrediction}</p>
                    <p className="text-xs text-[#0A1F44]/70 mb-3 font-medium">
                      AI Score: {insight.aiScore}/100
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate("/analysis", { state: { assetId: insight.id } })
                        }
                        className="flex-1 py-2.5 px-4 rounded-xl border-2 border-[#0A1F44] text-[#0A1F44] font-medium text-sm hover:bg-[#0A1F44]/5 transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => requestAdd(insightToAsset(insight))}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-[#0A1F44] text-white font-medium text-sm hover:bg-[#0A1F44]/90 transition-colors"
                      >
                        Add to Portfolio
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      {pickerDialog}
    </div>
  );
}