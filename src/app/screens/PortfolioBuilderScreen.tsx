import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Plus,
  Search,
  Trash2,
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

    const holdingIds = new Set(selectedPortfolio.holdings.map((item) => item.id));

    return (
      <>
        <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
          <button
            onClick={() => {
              setShowPicker(false);
              setView("list");
            }}
            className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
          </button>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#0A1F44]">
                {selectedPortfolio.name}
              </h1>
              <p className="text-gray-600 mt-2">
                {selectedPortfolio.holdings.length} companies in this portfolio
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="w-10 h-10 rounded-2xl bg-[#E03A3E]/10 flex items-center justify-center shrink-0"
              aria-label="Delete portfolio"
            >
              <Trash2 className="w-4 h-4 text-[#E03A3E]" />
            </button>
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl border-0 max-w-[340px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#0A1F44]">
                Delete portfolio?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 leading-relaxed">
                You are about to delete{" "}
                <span className="font-semibold text-[#0A1F44]">
                  {selectedPortfolio.name}
                </span>
                . This removes all {selectedPortfolio.holdings.length}{" "}
                {selectedPortfolio.holdings.length === 1 ? "company" : "companies"}{" "}
                from this portfolio. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-col-reverse gap-2">
              <AlertDialogCancel className="rounded-2xl h-11 border-gray-200">
                Keep portfolio
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-2xl h-11 bg-[#E03A3E] hover:bg-[#E03A3E]/90"
                onClick={() => {
                  deletePortfolio(selectedPortfolio.id);
                  setDeleteDialogOpen(false);
                  setView("list");
                }}
              >
                Yes, delete portfolio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="px-6 space-y-4 pb-8">
          <Button
            onClick={() => setShowPicker((open) => !open)}
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
                  onChange={(e) => setCompanySearch(e.target.value)}
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
                      onClick={() => handleAddCompany(asset)}
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

          {selectedPortfolio.holdings.length === 0 ? (
            <Card className="p-6 rounded-3xl shadow-sm border-0 text-center">
              <p className="text-gray-600 text-sm">
                No companies yet. Tap &quot;Add companies&quot; to build this portfolio.
              </p>
            </Card>
          ) : (
            selectedPortfolio.holdings.map((asset) => (
              <Card
                key={asset.id}
                className="p-4 rounded-2xl shadow-sm border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#0A1F44]">{asset.name}</h3>
                    <p className="text-sm text-gray-500">{asset.ticker}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {asset.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      removeFromPortfolio(asset.id, selectedPortfolio.id)
                    }
                    className="w-9 h-9 rounded-xl bg-[#F5F7FA] flex items-center justify-center shrink-0"
                    aria-label={`Remove ${asset.name}`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </>
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
