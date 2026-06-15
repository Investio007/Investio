import { useState } from "react";
import type { InvestioAsset } from "../data/assets";
import { useInvestio } from "../context/InvestioContext";
import { AddToPortfolioDialog } from "../components/AddToPortfolioDialog";

export function useAddToPortfolioWithPicker() {
  const { portfolios, activePortfolioId, addToPortfolio } = useInvestio();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<InvestioAsset | null>(null);

  const requestAdd = (asset: InvestioAsset) => {
    if (portfolios.length === 0) {
      addToPortfolio(asset);
      return;
    }

    if (portfolios.length === 1) {
      addToPortfolio(asset, portfolios[0].id);
      return;
    }

    setPendingAsset(asset);
    setPickerOpen(true);
  };

  const pickerDialog = (
    <AddToPortfolioDialog
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) setPendingAsset(null);
      }}
      asset={pendingAsset}
    />
  );

  const defaultPortfolioId =
    activePortfolioId ?? portfolios[0]?.id ?? undefined;

  return { requestAdd, pickerDialog, defaultPortfolioId };
}
