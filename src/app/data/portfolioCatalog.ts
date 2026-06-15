import { assets, companies, type InvestioAsset } from "./assets";
import { COUNTRY_STOCKS } from "./countryMarkets";

const DEFAULT_ANALYSIS: InvestioAsset["analysis"] = {
  growth: { label: "Moderate", color: "gold", pct: 55 },
  profitability: { label: "Moderate", color: "gold", pct: 55 },
  stability: { label: "Moderate", color: "gold", pct: 55 },
  competition: { label: "Moderate", color: "gold", pct: 50 },
};

function stubAsset(id: string, name: string, ticker: string): InvestioAsset {
  return {
    id,
    name,
    ticker,
    price: "—",
    priceRaw: 0,
    change: "—",
    changePositive: true,
    ratingColor: "gold",
    aiScore: 50,
    description: `${name} (${ticker})`,
    analysis: DEFAULT_ANALYSIS,
    explanation: "",
    chartPath: "M0 40 C80 38 160 36 240 34 C280 32 320 30 320 28",
  };
}

/** All companies the user can add to a portfolio. */
export function getPickableAssets(): InvestioAsset[] {
  const byId = new Map<string, InvestioAsset>();

  for (const asset of [...companies, ...assets]) {
    byId.set(asset.id, asset);
  }

  for (const stock of COUNTRY_STOCKS) {
    if (!byId.has(stock.id)) {
      byId.set(stock.id, stubAsset(stock.id, stock.name, stock.ticker));
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
