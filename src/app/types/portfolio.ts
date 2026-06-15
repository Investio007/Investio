import type { InvestioAsset } from "../data/assets";
import type { PortfolioConfig } from "../services/supabaseDb";

export type UserPortfolio = {
  id: string;
  name: string;
  createdAt: string;
  config: PortfolioConfig;
  holdings: InvestioAsset[];
};

export type PortfoliosStore = {
  version: 2;
  activePortfolioId: string | null;
  portfolios: UserPortfolio[];
};

export function createEmptyPortfolio(name: string, config: PortfolioConfig = null): UserPortfolio {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled Portfolio",
    createdAt: new Date().toISOString(),
    config,
    holdings: [],
  };
}

export function migrateLegacyPortfolio(
  holdings: InvestioAsset[],
  config: PortfolioConfig,
): PortfoliosStore {
  if (holdings.length === 0 && !config) {
    return { version: 2, activePortfolioId: null, portfolios: [] };
  }

  const portfolio = createEmptyPortfolio("My Demo Portfolio", config);
  portfolio.holdings = holdings;

  return {
    version: 2,
    activePortfolioId: portfolio.id,
    portfolios: [portfolio],
  };
}

export function applyAddToPortfolio(
  prev: PortfoliosStore,
  asset: InvestioAsset,
  portfolioId?: string,
): { store: PortfoliosStore; message: string } {
  let targetId = portfolioId ?? prev.activePortfolioId;
  let portfolios = prev.portfolios;
  let message = "";

  if (!targetId) {
    const created = createEmptyPortfolio("My Demo Portfolio");
    targetId = created.id;
    portfolios = [created, ...portfolios];
  }

  let portfolioName = "portfolio";
  portfolios = portfolios.map((item) => {
    if (item.id !== targetId) return item;
    portfolioName = item.name;
    if (item.holdings.some((holding) => holding.id === asset.id)) {
      message = `${asset.name} is already in ${portfolioName}`;
      return item;
    }
    message = `${asset.name} added to ${portfolioName}`;
    return { ...item, holdings: [...item.holdings, asset] };
  });

  return {
    store: {
      version: 2,
      activePortfolioId: targetId,
      portfolios,
    },
    message,
  };
}
