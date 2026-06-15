import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useCompare } from "../hooks/useMarketData";
import type { CompareCompany, CompareMetric } from "../services/marketApi";
import PriceSkeleton from "../components/PriceSkeleton";

const METRIC_ROWS: {
  key: keyof CompareCompany["analysis"];
  label: string;
  hint: string;
}[] = [
  {
    key: "growth",
    label: "Growth",
    hint: "Is the company getting bigger?",
  },
  {
    key: "profitability",
    label: "Profit",
    hint: "Does it make good money?",
  },
  {
    key: "stability",
    label: "Stability",
    hint: "Does the price swing a lot?",
  },
  {
    key: "competition",
    label: "News mood",
    hint: "Is the news mostly positive?",
  },
];

function metricColor(color: CompareMetric["color"]) {
  if (color === "green") return "bg-[#007A4D]";
  if (color === "gold") return "bg-[#FFB612]";
  return "bg-[#E03A3E]";
}

function scoreTextColor(score: number) {
  if (score >= 70) return "text-[#007A4D]";
  if (score >= 55) return "text-[#FFB612]";
  return "text-[#E03A3E]";
}

function formatPrice(company: CompareCompany): string {
  if (company.price == null) return "—";
  const prefix = company.currency === "USD" ? "$" : `${company.currency} `;
  return `${prefix}${company.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatChange(company: CompareCompany): string {
  if (company.changePercent == null) return "—";
  return `${company.changePositive ? "+" : ""}${company.changePercent.toFixed(1)}%`;
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "Updating…";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Live";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getMetric(
  company: CompareCompany,
  key: keyof CompareCompany["analysis"],
): CompareMetric {
  return company.analysis?.[key] ?? { pct: 0, label: "—", color: "gold" };
}

function bestInRow(
  companies: CompareCompany[],
  key: keyof CompareCompany["analysis"],
): string | null {
  const scored = companies.filter((company) => company.analysis?.[key]);
  if (scored.length === 0) return null;
  const best = scored.reduce((leader, company) =>
    getMetric(company, key).pct > getMetric(leader, key).pct ? company : leader,
  );
  return best.id;
}

export function CompareScreen() {
  const navigate = useNavigate();
  const {
    companies,
    verdict,
    updatedAt,
    stale,
    loading,
    error,
  } = useCompare();

  const rankedCompanies = useMemo(
    () =>
      [...companies].sort(
        (a, b) => (b.longTermScore ?? 0) - (a.longTermScore ?? 0),
      ),
    [companies],
  );

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-8">
      <div className="bg-white px-6 screen-header pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0A1F44]">
              Compare Companies
            </h1>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
              Live prices and scores for {companies.length || 8} top companies —
              scroll to compare all.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {formatUpdatedAt(updatedAt)}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5">
        {error && (
          <Card className="p-4 rounded-2xl border border-[#E03A3E]/20 bg-[#E03A3E]/5">
            <p className="text-sm text-[#E03A3E]">
              Could not load live data. Pull down to refresh or try again shortly.
            </p>
          </Card>
        )}

        {stale && !loading && (
          <p className="text-xs text-[#FFB612] text-center">
            Some prices may be delayed — showing the latest available data.
          </p>
        )}

        {verdict && !loading && (
          <Card className="p-5 rounded-3xl shadow-md border-0 bg-[#0A1F44] text-white">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-[#FFB612]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70 mb-1">
                  Our long-term pick
                </p>
                <h2 className="text-lg font-bold leading-snug">
                  {verdict.headline}
                </h2>
              </div>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">
              {verdict.summary}
            </p>
          </Card>
        )}

        {loading && companies.length === 0 ? (
          <Card className="p-6 rounded-3xl shadow-sm border-0">
            <PriceSkeleton />
            <p className="text-sm text-gray-500 mt-4 text-center">
              Loading live market data…
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-4 rounded-3xl shadow-sm border-0 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
                Live prices today
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() =>
                      navigate("/analysis", { state: { assetId: company.id } })
                    }
                    className={`min-w-[118px] shrink-0 rounded-2xl p-3 text-left transition-all ${
                      company.isWinner
                        ? "bg-[#007A4D]/10 ring-2 ring-[#007A4D]/30"
                        : "bg-[#F5F7FA]"
                    }`}
                  >
                    {company.isWinner && (
                      <span className="text-[10px] font-bold text-[#007A4D] uppercase">
                        Top pick
                      </span>
                    )}
                    <p className="text-xs text-gray-600 truncate">{company.ticker}</p>
                    <p className="text-sm font-bold text-[#0A1F44] truncate">
                      {company.name}
                    </p>
                    <p className="text-base font-bold text-[#0A1F44] mt-1">
                      {loading ? <PriceSkeleton /> : formatPrice(company)}
                    </p>
                    <div
                      className={`flex items-center gap-0.5 text-xs font-medium mt-0.5 ${
                        company.changePositive
                          ? "text-[#007A4D]"
                          : "text-[#E03A3E]"
                      }`}
                    >
                      {company.changePositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {formatChange(company)}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 rounded-3xl shadow-sm border-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 px-1">
                Side-by-side scores
              </p>
              <p className="text-xs text-gray-500 mb-4 px-1">
                Higher is better. Green = good, yellow = okay, red = caution.
              </p>

              <div className="space-y-4">
                {METRIC_ROWS.map((row) => {
                  const leaderId = bestInRow(companies, row.key);
                  return (
                    <div key={row.key}>
                      <div className="mb-2 px-1">
                        <p className="text-sm font-semibold text-[#0A1F44]">
                          {row.label}
                        </p>
                        <p className="text-xs text-gray-500">{row.hint}</p>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                        {companies.map((company) => {
                          const metric = getMetric(company, row.key);
                          const isBest = company.id === leaderId;
                          return (
                            <div
                              key={`${company.id}-${row.key}`}
                              className={`min-w-[72px] shrink-0 rounded-xl p-2 text-center ${
                                isBest ? "bg-[#007A4D]/8 ring-1 ring-[#007A4D]/20" : "bg-[#F5F7FA]"
                              }`}
                            >
                              <p className="text-[10px] text-gray-500 mb-1 truncate">
                                {company.ticker}
                              </p>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${metricColor(metric.color)}`}
                                />
                                <span className="text-sm font-bold text-[#0A1F44]">
                                  {metric.pct}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-600">{metric.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {rankedCompanies.map((company, index) => (
              <Card
                key={company.id}
                className={`p-5 rounded-3xl shadow-sm border-0 ${
                  company.isWinner ? "ring-2 ring-[#007A4D]/25" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <h3 className="text-lg font-bold text-[#0A1F44]">
                        {company.name}
                      </h3>
                      {company.isWinner && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#007A4D] bg-[#007A4D]/10 px-2 py-0.5 rounded-full">
                          Best long-term
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{company.ticker}</p>
                    {(company.badges ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(company.badges ?? []).map((badge) => (
                          <span
                            key={badge}
                            className="text-[10px] font-medium text-[#0A1F44] bg-[#F5F7FA] px-2 py-0.5 rounded-full"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Long-term score</p>
                    <p
                      className={`text-2xl font-bold ${scoreTextColor(company.longTermScore ?? 0)}`}
                    >
                      {company.longTermScore ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-gray-500">Health score</span>
                    <span
                      className={`text-xl font-bold ${scoreTextColor(company.aiScore ?? 0)}`}
                    >
                      {company.aiScore ?? "—"}
                    </span>
                    <span className="text-xs text-gray-500">/100</span>
                  </div>
                  <p className="text-sm font-medium text-[#0A1F44]">
                    {company.rating}
                  </p>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  {company.explanation}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate("/analysis", { state: { assetId: company.id } })
                  }
                  className="w-full h-11 rounded-2xl border-[#0A1F44]/15 text-[#0A1F44]"
                >
                  See full analysis
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Card>
            ))}
          </>
        )}

        {verdict && (
          <Card className="p-5 rounded-3xl shadow-sm border-0 bg-[#F5F7FA]">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-[#FFB612]" />
              <h3 className="font-bold text-[#0A1F44]">Tips for beginners</h3>
            </div>
            <ul className="space-y-2">
              {verdict.tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#007A4D] shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
