import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "../components/ui/card";
import { MobileNav } from "../components/MobileNav";
import { companies } from "../data/assets";
import { useCompare } from "../hooks/useMarketData";
import PriceSkeleton from "../components/PriceSkeleton";

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

const getScoreColor = (score: number) => {
  if (score >= 85) return "text-[#007A4D]";
  if (score >= 70) return "text-[#FFB612]";
  return "text-[#E03A3E]";
};

export function CompareScreen() {
  const navigate = useNavigate();
  const { data: liveCompanies, loading: compareLoading, error: compareError } = useCompare();

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <h1 className="text-2xl font-bold text-[#0A1F44]">
          Compare Companies
        </h1>
        <p className="text-gray-600 mt-2">
          See how top companies stack up against each other
        </p>
      </div>

      <div className="px-6 space-y-4 pb-8">
        {companies.map((company) => {
          const live = liveCompanies.find((item) => item.id === company.id);
          const hasLive = !!live && !compareError;
          const price =
            hasLive && live.price != null ? `$${live.price.toFixed(2)}` : company.price;
          const change =
            hasLive && live.changePercent != null
              ? `${live.changePositive ? "+" : ""}${live.changePercent.toFixed(1)}%`
              : company.change;
          const changePositive =
            hasLive && typeof live.changePositive === "boolean"
              ? live.changePositive
              : company.changePositive;

          return (
            <Card
              key={company.id}
              onClick={() => navigate("/analysis", { state: { assetId: company.id } })}
              className="p-6 rounded-3xl shadow-sm border-0 hover:shadow-md transition-shadow"
              style={{ cursor: "pointer" }}
            >
            {/* Company Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#0A1F44] mb-1">
                  {company.name}
                </h3>
                <p className="text-sm text-gray-600">{company.ticker}</p>
              </div>
              <div className={`w-4 h-4 rounded-full ${getRatingColor(company.rating ?? "")}`} />
            </div>

            {/* AI Score */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm text-gray-600">AI Score:</span>
                <span className={`text-3xl font-bold ${getScoreColor(company.aiScore)}`}>
                  {company.aiScore}
                </span>
                <span className="text-sm text-gray-600">/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    company.aiScore >= 85
                      ? "bg-[#007A4D]"
                      : company.aiScore >= 70
                      ? "bg-[#FFB612]"
                      : "bg-[#E03A3E]"
                  }`}
                  style={{ width: `${company.aiScore}%` }}
                />
              </div>
            </div>

            {/* Price Info */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-[#0A1F44]">
                {compareLoading ? <PriceSkeleton /> : price}
              </span>
              <div
                className={`flex items-center gap-1 ${
                  changePositive ? "text-[#007A4D]" : "text-[#E03A3E]"
                }`}
              >
                {changePositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-medium">{change}</span>
              </div>
            </div>

            {/* Explanation */}
            <p className="text-gray-700 leading-relaxed">{company.description}</p>
            </Card>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <MobileNav />
    </div>
  );
}