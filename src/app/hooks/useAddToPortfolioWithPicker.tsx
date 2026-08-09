import { useState } from "react";
import type { CrowthAsset } from "../data/assets";
import { useCrowth } from "../context/CrowthContext";
import { AddToPortfolioDialog } from "../components/AddToPortfolioDialog";

export function useAddToPortfolioWithPicker() {
  const { portfolios, activePortfolioId, addToPortfolio } = useCrowth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<CrowthAsset | null>(null);

  const requestAdd = (asset: CrowthAsset) => {
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
