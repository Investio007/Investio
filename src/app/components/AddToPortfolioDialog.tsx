import { Briefcase, ChevronRight } from "lucide-react";
import type { InvestioAsset } from "../data/assets";
import { useInvestio } from "../context/InvestioContext";
import { PhoneModal } from "./PhoneModal";

type AddToPortfolioDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: InvestioAsset | null;
  onAdded?: () => void;
};

export function AddToPortfolioDialog({
  open,
  onOpenChange,
  asset,
  onAdded,
}: AddToPortfolioDialogProps) {
  const { portfolios, addToPortfolio, setActivePortfolio } = useInvestio();

  const handleSelect = (portfolioId: string) => {
    if (!asset) return;
    setActivePortfolio(portfolioId);
    addToPortfolio(asset, portfolioId);
    onOpenChange(false);
    onAdded?.();
  };

  return (
    <PhoneModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add to portfolio"
      description={
        asset
          ? `Choose which portfolio should hold ${asset.name} (${asset.ticker}).`
          : "Choose a portfolio."
      }
    >
      <div className="space-y-2">
        {portfolios.map((portfolio) => {
          const alreadyHas = asset
            ? portfolio.holdings.some((holding) => holding.id === asset.id)
            : false;

          return (
            <button
              key={portfolio.id}
              type="button"
              disabled={alreadyHas}
              onClick={() => handleSelect(portfolio.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors ${
                alreadyHas
                  ? "bg-gray-100 opacity-60 cursor-not-allowed"
                  : "bg-[#F5F7FA] hover:bg-[#0A1F44]/5"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0A1F44]/10 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-[#0A1F44]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0A1F44] truncate">
                  {portfolio.name}
                </p>
                <p className="text-xs text-gray-500">
                  {alreadyHas
                    ? "Already in this portfolio"
                    : `${portfolio.holdings.length} companies`}
                </p>
              </div>
              {!alreadyHas && (
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </PhoneModal>
  );
}
