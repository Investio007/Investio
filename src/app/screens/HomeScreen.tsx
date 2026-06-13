import { useState } from "react";
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
import { MobileNav } from "../components/MobileNav";
import { useInvestio } from "../context/InvestioContext";
import { assets } from "../data/assets";
import PriceChart from "../components/PriceChart";
import { useInsights, useQuote } from "../hooks/useMarketData";
import PriceSkeleton from "../components/PriceSkeleton";
import type { Period } from "../services/marketApi";

type SelectableStock = {
  id: string;
  label: string;
  ticker: string;
  group: "watchlist" | "popular";
};

const selectableStocks: SelectableStock[] = [
  { id: "aitech", label: "QQQ", ticker: "QQQ", group: "watchlist" },
  { id: "energy", label: "XLE", ticker: "XLE", group: "watchlist" },
  { id: "crypto", label: "BTC", ticker: "BTC-USD", group: "watchlist" },
  { id: "apple", label: "AAPL", ticker: "AAPL", group: "popular" },
  { id: "microsoft", label: "MSFT", ticker: "MSFT", group: "popular" },
  { id: "tesla", label: "TSLA", ticker: "TSLA", group: "popular" },
  { id: "nvidia", label: "NVDA", ticker: "NVDA", group: "popular" },
  { id: "amazon", label: "AMZN", ticker: "AMZN", group: "popular" },
  { id: "meta", label: "META", ticker: "META", group: "popular" },
];

const PERIODS: Period[] = ["1D", "1W", "1M", "6M", "1Y"];

const fallbackDataByPeriod: Record<Period, Array<{ time: string; close: number }>> = {
  "1D": [
    { time: "09:00", close: 24780 },
    { time: "11:00", close: 24820 },
    { time: "13:00", close: 24760 },
    { time: "15:00", close: 24890 },
    { time: "17:00", close: 24940 },
  ],
  "1W": [
    { time: "Mon", close: 24200 },
    { time: "Tue", close: 24500 },
    { time: "Wed", close: 24300 },
    { time: "Thu", close: 24800 },
    { time: "Fri", close: 25000 },
  ],
  "1M": [
    { time: "W1", close: 23800 },
    { time: "W2", close: 24150 },
    { time: "W3", close: 24600 },
    { time: "W4", close: 25040 },
  ],
  "6M": [
    { time: "Jan", close: 22600 },
    { time: "Feb", close: 23100 },
    { time: "Mar", close: 23750 },
    { time: "Apr", close: 24400 },
    { time: "May", close: 24820 },
    { time: "Jun", close: 25200 },
  ],
  "1Y": [
    { time: "Q1", close: 21000 },
    { time: "Q2", close: 22350 },
    { time: "Q3", close: 23600 },
    { time: "Q4", close: 25200 },
  ],
};

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

export function HomeScreen() {
  const navigate = useNavigate();
  const { demoBalance, addToPortfolio, toast } = useInvestio();
  const { data: insights, loading: insightsLoading, error: insightsError } = useInsights();
  const [selectedStock, setSelectedStock] = useState<SelectableStock>(selectableStocks[0]);
  const [activePeriod, setActivePeriod] = useState<Period>("1D");
  const { data: selectedQuote, loading: quoteLoading } = useQuote(selectedStock.id);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <style>
        {`
          .stock-selector-scroll::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      {/* Header */}
      <div className="bg-[#0A1F44] text-white px-6 pt-12 pb-24 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-white/80 mb-1">Welcome back</p>
            <h1 className="text-2xl font-bold">Your Demo Portfolio</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut();
                }
                localStorage.clear();
                navigate("/auth");
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
              }}
            >
              <LogOut size={16} />
            </button>
            <button
              onClick={() => navigate("/add-funds")}
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 pb-24">
        {/* Portfolio Value Card */}
        <Card className="p-6 mb-6 rounded-3xl shadow-lg border-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-600 mb-2">Demo Portfolio Value</p>
              <h2 className="text-4xl font-bold text-[#0A1F44]">
                R {demoBalance.toLocaleString()}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Simulation Mode — No real funds used
              </p>
            </div>
            <div className="bg-[#007A4D]/10 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-1 text-[#007A4D]">
                <ArrowUp className="w-4 h-4" />
                <span className="font-medium">+R 420</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-[#007A4D] mb-4">+1.68% today</p>

          {/* Portfolio Chart */}
          <div className="mt-4">
            <div className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide">
              Select Stock
            </div>
            <div
              className="stock-selector-scroll"
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <div className="text-[10px] text-gray-400 mb-1">My Watchlist</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {selectableStocks
                    .filter((stock) => stock.group === "watchlist")
                    .map((stock) => {
                      const isSelected = selectedStock.id === stock.id;
                      return (
                        <button
                          key={stock.id}
                          onClick={() => setSelectedStock(stock)}
                          style={{
                            flexShrink: 0,
                            padding: "5px 12px",
                            borderRadius: 20,
                            border: isSelected
                              ? "1.5px solid #007A4D"
                              : "1.5px solid rgba(10,31,68,0.14)",
                            background: isSelected ? "rgba(0,122,77,0.08)" : "transparent",
                            color: isSelected ? "#007A4D" : "rgba(10,31,68,0.65)",
                            fontSize: 12,
                            fontWeight: isSelected ? 600 : 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stock.label}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div className="text-[10px] text-gray-400 mb-1">Popular Stocks</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {selectableStocks
                    .filter((stock) => stock.group === "popular")
                    .map((stock) => {
                      const isSelected = selectedStock.id === stock.id;
                      return (
                        <button
                          key={stock.id}
                          onClick={() => setSelectedStock(stock)}
                          style={{
                            flexShrink: 0,
                            padding: "5px 12px",
                            borderRadius: 20,
                            border: isSelected
                              ? "1.5px solid #007A4D"
                              : "1.5px solid rgba(10,31,68,0.14)",
                            background: isSelected ? "rgba(0,122,77,0.08)" : "transparent",
                            color: isSelected ? "#007A4D" : "rgba(10,31,68,0.65)",
                            fontSize: 12,
                            fontWeight: isSelected ? 600 : 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stock.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3 mb-2">
              {quoteLoading ? (
                <div style={{ width: 100 }}>
                  <PriceSkeleton />
                </div>
              ) : (
                <>
                  <span className="text-xl font-bold text-[#0A1F44]">
                    {selectedQuote?.currency === "ZAr" || selectedQuote?.currency === "ZAR"
                      ? "R"
                      : selectedQuote?.currency === "USD"
                      ? "$"
                      : selectedQuote?.currency || "$"}{" "}
                    {selectedQuote?.price?.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) ?? "—"}
                  </span>
                  {selectedQuote?.changePercent != null && (
                    <span
                      className={`text-xs font-medium ${
                        selectedQuote.changePositive ? "text-[#007A4D]" : "text-[#E03A3E]"
                      }`}
                    >
                      {selectedQuote.changePositive ? "↑" : "↓"}{" "}
                      {Math.abs(selectedQuote.changePercent).toFixed(2)}%
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">{selectedStock.ticker}</span>
                </>
              )}
            </div>
            <PriceChart
              key={`${selectedStock.id}-${activePeriod}`}
              symbol={selectedStock.id}
              initialPeriod={activePeriod}
              showPeriodSelector={false}
              height={90}
              color={selectedQuote?.changePositive === false ? "#E03A3E" : "#007A4D"}
              fallbackDataByPeriod={fallbackDataByPeriod}
            />
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {PERIODS.map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  className={`period-btn${activePeriod === period ? " active" : ""}`}
                >
                  {period}
                </button>
              ))}
            </div>
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

        {/* AI Investment Insights */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-4">
            AI Market Insights
          </h3>

          <div className="space-y-3">
            {assets.map((asset) => {
              const live = insights.find((insight) => insight.id === asset.id);
              const hasLiveData =
                !insightsError && live?.price != null && live.changePercent != null;
              const price =
                hasLiveData && live?.price != null
                  ? `R${live.price.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : asset.price;
              const change =
                hasLiveData && live?.changePercent != null
                  ? `${live.changePositive ? "+" : ""}${live.changePercent.toFixed(1)}%`
                  : asset.change;
              const changePositive = hasLiveData
                ? (live?.changePositive ?? asset.changePositive)
                : asset.changePositive;

              return (
                <Card
                  key={asset.id}
                className="p-4 rounded-2xl shadow-sm border-0 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[#0A1F44]">
                        {asset.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-lg font-bold text-[#0A1F44]">
                        {insightsLoading && !hasLiveData ? <PriceSkeleton /> : price}
                      </span>
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          changePositive
                            ? "text-[#007A4D]"
                            : "text-[#E03A3E]"
                        }`}
                      >
                        {changePositive ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        <span>{change} today</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                      asset.ratingColor === "green"
                        ? "bg-[#007A4D]/10"
                        : asset.ratingColor === "gold"
                        ? "bg-[#FFB612]/10"
                        : "bg-[#E03A3E]/10"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${getRatingColor(
                        asset.ratingColor
                      )}`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        asset.ratingColor === "green"
                          ? "text-[#007A4D]"
                          : asset.ratingColor === "gold"
                          ? "text-[#FFB612]"
                          : "text-[#E03A3E]"
                      }`}
                    >
                      {asset.rating}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  {asset.description}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate("/analysis", { state: { assetId: asset.id } })
                    }
                    className="flex-1 py-2.5 px-4 rounded-xl border-2 border-[#0A1F44] text-[#0A1F44] font-medium text-sm hover:bg-[#0A1F44]/5 transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => addToPortfolio(asset)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#0A1F44] text-white font-medium text-sm hover:bg-[#0A1F44]/90 transition-colors"
                  >
                    Add to Portfolio
                  </button>
                </div>
              </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MobileNav />
      {toast.visible && (
        <div
          className="toast"
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0A1F44",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 20,
            fontSize: 13,
            zIndex: 999,
            whiteSpace: "nowrap",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}