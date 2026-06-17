import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Briefcase,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useInvestio } from "../context/InvestioContext";
import { getPickableAssets } from "../data/portfolioCatalog";
import type { InvestioAsset } from "../data/assets";
import type { PortfolioConfig } from "../services/supabaseDb";
import type { UserPortfolio } from "../types/portfolio";
import { usePortfolioQuotes } from "../hooks/useMarketData";
import {
  computePortfolioPerformance,
  formatChangePercent,
  formatQuotePrice,
  formatRand,
  holdingDayPnl,
} from "../lib/portfolioPerformance";
import type { QuoteData } from "../services/marketApi";

const COLORS = ["#007A4D", "#3B82F6", "#FFB612"];

type ScreenView = "list" | "create" | "detail";

function getAllocationData(riskIndex: number) {
  if (riskIndex === 0) {
    return [
      { name: "Growth", value: 20, color: COLORS[0] },
      { name: "Balanced", value: 30, color: COLORS[1] },
      { name: "Safe", value: 50, color: COLORS[2] },
    ];
  }
  if (riskIndex === 1) {
    return [
      { name: "Growth", value: 40, color: COLORS[0] },
      { name: "Balanced", value: 40, color: COLORS[1] },
      { name: "Safe", value: 20, color: COLORS[2] },
    ];
  }
  return [
    { name: "Growth", value: 60, color: COLORS[0] },
    { name: "Balanced", value: 30, color: COLORS[1] },
    { name: "Safe", value: 10, color: COLORS[2] },
  ];
}

function riskLabel(riskIndex: number) {
  if (riskIndex === 0) return "Low";
  if (riskIndex === 1) return "Medium";
  return "High";
}

function PerformanceBadge({
  quote,
  size = "sm",
}: {
  quote: QuoteData | undefined;
  size?: "sm" | "md";
}) {
  if (!quote || quote.changePercent == null) {
    return (
      <span className="text-xs text-gray-400 font-medium">—</span>
    );
  }

  const positive = quote.changePositive;
  const textClass =
    size === "md" ? "text-sm font-semibold" : "text-xs font-semibold";
  const Icon = positive ? ArrowUp : ArrowDown;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${textClass} ${
        positive ? "text-[#007A4D]" : "text-[#E03A3E]"
      }`}
    >
      <Icon className={size === "md" ? "w-4 h-4" : "w-3 h-3"} />
      {formatChangePercent(quote)}
    </span>
  );
}

function PortfolioSummaryCard({
  performance,
  loading,
}: {
  performance: ReturnType<typeof computePortfolioPerformance>;
  loading: boolean;
}) {
  const positive =
    performance.avgChangePercent != null && performance.avgChangePercent >= 0;

  return (
    <Card className="p-5 rounded-3xl shadow-sm border-0 bg-[#0A1F44] text-white">
      <p className="text-white/70 text-xs uppercase tracking-wide mb-1">
        Demo portfolio value
      </p>
      <p className="text-3xl font-bold mb-4">
        {formatRand(performance.totalValue)}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-white/70 text-xs mb-1">Today&apos;s move</p>
          {loading && performance.quotedCount === 0 ? (
            <div className="h-6 w-24 bg-white/10 rounded animate-pulse" />
          ) : performance.avgChangePercent != null ? (
            <p
              className={`text-lg font-bold flex items-center gap-1 ${
                positive ? "text-[#7DFFB3]" : "text-[#FF8A8A]"
              }`}
            >
              {positive ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              {positive ? "+" : ""}
              {performance.avgChangePercent.toFixed(2)}%
              {performance.dayPnl != null && (
                <span className="text-sm font-medium text-white/80 ml-1">
                  ({positive ? "+" : "−"}
                  {formatRand(performance.dayPnl)})
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-white/60">Prices updating…</p>
          )}
        </div>
        <div>
          <p className="text-white/70 text-xs mb-1">Holdings</p>
          <p className="text-lg font-bold">
            {performance.holdingCount}{" "}
            {performance.holdingCount === 1 ? "company" : "companies"}
          </p>
          <p className="text-xs text-white/60 mt-1">
            {performance.gainers} up · {performance.losers} down
            {performance.flat > 0 ? ` · ${performance.flat} flat` : ""}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-white/50 mt-4 leading-relaxed">
        Equal-weight demo split (
        {formatRand(performance.perHoldingValue)} per company). Day change uses
        live market prices.
      </p>
    </Card>
  );
}

function HoldingRow({
  asset,
  quote,
  perHoldingValue,
  onRemove,
  onOpen,
}: {
  asset: InvestioAsset;
  quote: QuoteData | undefined;
  perHoldingValue: number;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const dayPnl = holdingDayPnl(perHoldingValue, quote);
  const positive = quote?.changePositive ?? true;

  return (
    <Card className="p-0 rounded-2xl shadow-sm border-0 overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="w-full p-4 text-left hover:bg-[#F5F7FA]/80 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-[#0A1F44] truncate">{asset.name}</h3>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </div>
            <p className="text-sm text-gray-500">{asset.ticker}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-[#0A1F44]">
              {formatQuotePrice(quote)}
            </p>
            <PerformanceBadge quote={quote} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-500">
            Demo share: {formatRand(perHoldingValue)}
          </span>
          {dayPnl != null ? (
            <span
              className={`font-semibold ${
                positive ? "text-[#007A4D]" : "text-[#E03A3E]"
              }`}
            >
              Today: {dayPnl >= 0 ? "+" : "−"}
              {formatRand(dayPnl)}
            </span>
          ) : (
            <span className="text-gray-400">Today: —</span>
          )}
        </div>
      </button>
      <div className="px-4 pb-3 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-9 h-9 rounded-xl bg-[#F5F7FA] flex items-center justify-center"
          aria-label={`Remove ${asset.name}`}
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </Card>
  );
}

type PortfolioDetailPanelProps = {
  portfolio: UserPortfolio;
  companySearch: string;
  showPicker: boolean;
  filteredPickable: InvestioAsset[];
  deleteDialogOpen: boolean;
  onBack: () => void;
  onDeleteDialogChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  onTogglePicker: () => void;
  onSearchChange: (value: string) => void;
  onAddCompany: (asset: InvestioAsset) => void;
  onRemoveCompany: (assetId: string) => void;
  navigate: ReturnType<typeof useNavigate>;
};

function PortfolioDetailPanel({
  portfolio,
  companySearch,
  showPicker,
  filteredPickable,
  deleteDialogOpen,
  onBack,
  onDeleteDialogChange,
  onConfirmDelete,
  onTogglePicker,
  onSearchChange,
  onAddCompany,
  onRemoveCompany,
  navigate,
}: PortfolioDetailPanelProps) {
  const holdingIds = useMemo(
    () => new Set(portfolio.holdings.map((item) => item.id)),
    [portfolio.holdings],
  );
  const assetIds = useMemo(
    () => portfolio.holdings.map((item) => item.id),
    [portfolio.holdings],
  );
  const { quotes, loading: quotesLoading, error: quotesError } =
    usePortfolioQuotes(assetIds);

  const totalValue = portfolio.config?.amount ?? 25_000;
  const performance = useMemo(
    () => computePortfolioPerformance(portfolio.holdings, quotes, totalValue),
    [portfolio.holdings, quotes, totalValue],
  );

  return (
    <>
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={onBack}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0A1F44]">{portfolio.name}</h1>
            <p className="text-gray-600 mt-2">
              {portfolio.holdings.length}{" "}
              {portfolio.holdings.length === 1 ? "company" : "companies"}
              {portfolio.config?.risk ? ` · ${portfolio.config.risk} risk` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDeleteDialogChange(true)}
            className="w-10 h-10 rounded-2xl bg-[#E03A3E]/10 flex items-center justify-center shrink-0"
            aria-label="Delete portfolio"
          >
            <Trash2 className="w-4 h-4 text-[#E03A3E]" />
          </button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent className="rounded-3xl border-0 max-w-[340px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0A1F44]">
              Delete portfolio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 leading-relaxed">
              You are about to delete{" "}
              <span className="font-semibold text-[#0A1F44]">{portfolio.name}</span>
              . This removes all {portfolio.holdings.length}{" "}
              {portfolio.holdings.length === 1 ? "company" : "companies"} from
              this portfolio. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse gap-2">
            <AlertDialogCancel className="rounded-2xl h-11 border-gray-200">
              Keep portfolio
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl h-11 bg-[#E03A3E] hover:bg-[#E03A3E]/90"
              onClick={onConfirmDelete}
            >
              Yes, delete portfolio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="px-6 space-y-4 pb-8">
        {portfolio.holdings.length > 0 && (
          <PortfolioSummaryCard performance={performance} loading={quotesLoading} />
        )}

        {quotesError && (
          <p className="text-xs text-[#E03A3E] bg-[#E03A3E]/10 rounded-xl px-3 py-2">
            {quotesError}
          </p>
        )}

        <Button
          onClick={onTogglePicker}
          variant="outline"
          className="w-full h-12 rounded-2xl border-2 border-[#0A1F44] text-[#0A1F44]"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showPicker ? "Hide company list" : "Add companies"}
        </Button>

        {showPicker && (
          <Card className="p-4 rounded-3xl shadow-sm border-0">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={companySearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search companies..."
                className="h-11 pl-9 rounded-2xl bg-[#F5F7FA] border-0"
              />
            </div>
            <div className="max-h-56 overflow-y-auto scrollbar-hide space-y-2">
              {filteredPickable.map((asset) => {
                const alreadyAdded = holdingIds.has(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => onAddCompany(asset)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-colors ${
                      alreadyAdded
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-[#F5F7FA] hover:bg-[#0A1F44]/5"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0A1F44] text-sm">
                        {asset.name}
                      </p>
                      <p className="text-xs text-gray-500">{asset.ticker}</p>
                    </div>
                    <span className="text-xs font-medium">
                      {alreadyAdded ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {portfolio.holdings.length === 0 ? (
          <Card className="p-6 rounded-3xl shadow-sm border-0 text-center">
            <p className="text-gray-600 text-sm">
              No companies yet. Tap &quot;Add companies&quot; to build this portfolio.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-1">
              Holdings performance
            </p>
            {portfolio.holdings.map((asset) => (
              <HoldingRow
                key={asset.id}
                asset={asset}
                quote={quotes[asset.id]}
                perHoldingValue={performance.perHoldingValue}
                onRemove={() => onRemoveCompany(asset.id)}
                onOpen={() => navigate(`/stock/${asset.id}`)}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

export function PortfolioBuilderScreen() {
  const navigate = useNavigate();
  const {
    portfolios,
    activePortfolioId,
    createPortfolio,
    deletePortfolio,
    setActivePortfolio,
    addToPortfolio,
    removeFromPortfolio,
  } = useInvestio();

  const [view, setView] = useState<ScreenView>("list");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("10000");
  const [riskLevel, setRiskLevel] = useState([1]);
  const [goal, setGoal] = useState("growth");
  const [companySearch, setCompanySearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const pickableAssets = useMemo(() => getPickableAssets(), []);
  const portfolioData = getAllocationData(riskLevel[0]);

  const selectedPortfolio = portfolios.find(
    (item) => item.id === selectedPortfolioId,
  );

  const filteredPickable = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return pickableAssets;
    return pickableAssets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(query) ||
        asset.ticker.toLowerCase().includes(query),
    );
  }, [companySearch, pickableAssets]);

  const openPortfolio = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    setActivePortfolio(portfolioId);
    setShowPicker(false);
    setCompanySearch("");
    setView("detail");
  };

  const handleCreatePortfolio = () => {
    const allocation = {
      growth: portfolioData.find((item) => item.name === "Growth")?.value || 0,
      balanced:
        portfolioData.find((item) => item.name === "Balanced")?.value || 0,
      safe: portfolioData.find((item) => item.name === "Safe")?.value || 0,
    };

    const config: PortfolioConfig = {
      amount: Number(amount) || 0,
      risk: riskLabel(riskLevel[0]),
      goal,
      allocation,
    };

    const id = createPortfolio(newName.trim() || "New Portfolio", config);
    setNewName("");
    setAmount("10000");
    setRiskLevel([1]);
    setGoal("growth");
    openPortfolio(id);
  };

  const handleAddCompany = (asset: InvestioAsset) => {
    if (!selectedPortfolioId) return;
    addToPortfolio(asset, selectedPortfolioId);
  };

  const renderList = () => (
    <>
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <h1 className="text-2xl font-bold text-[#0A1F44]">My Portfolios</h1>
        <p className="text-gray-600 mt-2">
          Create portfolios and add companies to each one.
        </p>
      </div>

      <div className="px-6 space-y-4 pb-8">
        <Button
          onClick={() => setView("create")}
          className="w-full h-14 rounded-2xl bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white text-base"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Portfolio
        </Button>

        {portfolios.length === 0 ? (
          <Card className="p-6 rounded-3xl shadow-sm border-0 text-center">
            <Briefcase className="w-10 h-10 text-[#0A1F44]/40 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              No portfolios yet. Create one to start adding companies.
            </p>
          </Card>
        ) : (
          portfolios.map((item) => (
            <Card
              key={item.id}
              className={`p-4 rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow ${
                item.id === activePortfolioId ? "ring-2 ring-[#0A1F44]/20" : ""
              }`}
              onClick={() => openPortfolio(item.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#0A1F44] truncate">
                      {item.name}
                    </h3>
                    {item.id === activePortfolioId && (
                      <span className="text-[10px] uppercase tracking-wide text-[#007A4D] font-semibold">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {item.holdings.length}{" "}
                    {item.holdings.length === 1 ? "company" : "companies"}
                    {item.config?.risk ? ` · ${item.config.risk} risk` : ""}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );

  const renderCreate = () => (
    <>
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={() => setView("list")}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <h1 className="text-2xl font-bold text-[#0A1F44]">New Portfolio</h1>
        <p className="text-gray-600 mt-2">
          Name your portfolio and set your demo preferences.
        </p>
      </div>

      <div className="px-6 space-y-6 pb-8">
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label htmlFor="portfolio-name" className="text-[#0A1F44] mb-3 block">
            Portfolio name
          </Label>
          <Input
            id="portfolio-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Tech Growth, Retirement, SA Picks"
            className="h-12 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44]"
          />
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label htmlFor="amount" className="text-[#0A1F44] mb-3 block">
            Demo investment amount
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              R
            </span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 pl-10 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44]"
            />
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label className="text-[#0A1F44] mb-4 block">
            Risk level: {riskLabel(riskLevel[0])}
          </Label>
          <Slider value={riskLevel} onValueChange={setRiskLevel} max={2} step={1} />
          <div className="flex justify-between text-sm text-gray-600 mt-4">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label className="text-[#0A1F44] mb-3 block">Investment goal</Label>
          <div className="space-y-2">
            {[
              { id: "growth", label: "Wealth Growth" },
              { id: "income", label: "Passive Income" },
              { id: "retirement", label: "Retirement" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setGoal(option.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                  goal === option.id
                    ? "border-[#0A1F44] bg-[#0A1F44]/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className={`font-medium ${
                    goal === option.id ? "text-[#0A1F44]" : "text-gray-700"
                  }`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-lg font-bold text-[#0A1F44] mb-4">
            Suggested allocation
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={portfolioData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {portfolioData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Button
          onClick={handleCreatePortfolio}
          className="w-full h-14 rounded-2xl bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white text-lg"
        >
          Create Portfolio
        </Button>
      </div>
    </>
  );

  const renderDetail = () => {
    if (!selectedPortfolio) {
      return null;
    }

    return (
      <PortfolioDetailPanel
        portfolio={selectedPortfolio}
        companySearch={companySearch}
        showPicker={showPicker}
        filteredPickable={filteredPickable}
        deleteDialogOpen={deleteDialogOpen}
        onBack={() => {
          setShowPicker(false);
          setView("list");
        }}
        onDeleteDialogChange={setDeleteDialogOpen}
        onConfirmDelete={() => {
          deletePortfolio(selectedPortfolio.id);
          setDeleteDialogOpen(false);
          setView("list");
        }}
        onTogglePicker={() => setShowPicker((open) => !open)}
        onSearchChange={setCompanySearch}
        onAddCompany={handleAddCompany}
        onRemoveCompany={(assetId) =>
          removeFromPortfolio(assetId, selectedPortfolio.id)
        }
        navigate={navigate}
      />
    );
  };

  return (
    <div className="relative min-h-full bg-[#F5F7FA] pb-6">
      {view === "list" && renderList()}
      {view === "create" && renderCreate()}
      {view === "detail" && renderDetail()}
    </div>
  );
}
